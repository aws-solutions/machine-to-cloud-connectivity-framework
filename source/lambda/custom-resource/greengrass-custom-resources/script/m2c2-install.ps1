#Requires -RunAsAdministrator
#Requires -Version 5.1

# IMPORTANT NOTE FOR M2C2 Developers!
# Most of this script was generated via IoT Sitewise Edge Gateway creation
# Python3 download and installation was added and will need to be maintained

<#
.DESCRIPTION
    Installs and configures SiteWise Edge and the associated Greengrass software and permissions.

    Version: 1.0.28.0
.PARAMETER Yes
    Run non-interactively and assume yes to all prompts.
.PARAMETER InstallPath
    Path where SiteWise Edge software will be installed, default is 'C:\greengrass\v2'.
.PARAMETER GGCUser
    Greengrass Core user, default is 'ggc_user', if the user already exists user setup is skipped.
.PARAMETER GGCUserPass
    Greengrass Core user, defualt is 12 mix of alpha numeric chars length with 2 special characters.
.EXAMPLE
    Install in interactive mode:
    C:\PS> gateway.deploy.ps1

    Run non-interactively and assume yes to all prompts:
    C:\PS> gateway.deploy.ps1 -Yes
#>
param (
    [parameter(Mandatory = $false)]
    [switch]$Yes = $false,
    [parameter(Mandatory = $false)]
    [ValidateScript({ Test-Path -IsValid $_ })]
    [string]$InstallPath = "C:\greengrass\v2",
    [parameter(Mandatory = $false)]
    [ValidateScript({$_ -match '^[a-z_]([a-z0-9_-]{0,31}|[a-z0-9_-]{0,30}\$)$'})]
    [string]$GGCUser = "ggc_user",
    [parameter(Mandatory = $false)]
    [string]$GGCUserPass
)


class ScriptConstants {
    static [string] $AwsRegion = 'REGION_PLACEHOLDER'
    static [string] $IotThingName = 'THING_NAME_PLACEHOLDER'
    static [string] $IotRoleAlias = 'ROLE_ALIAS_PLACEHOLDER'
    static [string] $IotDataEndpoint = 'DATA_ENDPOINT_PLACEHOLDER'
    static [string] $IotCredentialEndpoint = 'CRED_ENDPOINT_PLACEHOLDER'
    static [string] $IotCertificatePem = 'CERTIFICATE_PEM_PLACEHOLDER'
    static [string] $IotPrivateKey = 'PRIVATE_KEY_PLACEHOLDER'
    static [string] $EnableDataProcessingPack = 'false'

    static [string] $Version = '1.0.28.0'

    static [string] $GreengrassNucleusVersion = '2.11.2'

    static [string] $PythonVersion = '3.9.1'

    static [switch] IsDataProcessingPackEnabled() {
        return [ScriptConstants]::EnableDataProcessingPack -ieq "true"
    }
}

enum LogLevel {
    Info
    Warning
    Error
}

class Logger {
    #"swe-install-$(Get-date -f 'yyyyMMddHHmmss').log"
    static [string] $Filename

    static [void] Init() {
        [Logger]::Init("swe-install-$(Get-date -f 'yyyyMMddHHmmss').log")
    }

    static [void] Init([string] $Filename) {
        [Logger]::Filename = $Filename
    }

    static [void] Write([LogLevel] $LogLevel, [PSObject] $Message) {
        [ConsoleColor] $MessageColor = [ConsoleColor]::White
        [string] $Preamble = ""

        switch ($LogLevel) {
            $([LogLevel]::Warning) {  
                $MessageColor = [ConsoleColor]::Yellow
                $Preamble = "${LogLevel}: "

            }
            $([LogLevel]::Error) {  
                $MessageColor = [ConsoleColor]::Red
                $Preamble = "${LogLevel}: "
                
            }
            Default {
                $MessageColor = [ConsoleColor]::White
                $Preamble = ""
            }
        }
        Write-Host "${Preamble}${Message}" -ForegroundColor $MessageColor
        [Logger]::Log($LogLevel, $Message)
    }

    static [void] Log([LogLevel] $LogLevel, [PSObject] $Message) {
        if ($null -ne $([Logger]::Filename)) {
            "[$(Get-Date -Format "o")][$LogLevel] - " | Out-File -FilePath $([Logger]::Filename) -Encoding ASCII -Append -NoNewline
            $message | Out-File -FilePath $([Logger]::Filename) -Encoding utf8 -Append
        }
    }
}

function local:Write-Error([PSObject] $Message) { [Logger]::Write([LogLevel]::Error, $Message) }
function local:Write-Warning([PSObject] $Message) { [Logger]::Write([LogLevel]::Warning, $Message) }
function local:Write-Info([PSObject] $Message) { [Logger]::Write([LogLevel]::Info, $Message) }
function local:LogError([PSObject] $Message) { [Logger]::Log([LogLevel]::Error, $Message) }
function local:LogWarning([PSObject] $Message) { [Logger]::Log([LogLevel]::Warning, $Message) }
function local:LogInfo([PSObject] $Message) { [Logger]::Log([LogLevel]::Info, $Message) }

class EnvironmentInfo {
    hidden [Object[]] $RequiredPorts = @(80, 443, 3001, 4569, 4572, 8000, 8081, 8082, 8084, 8085, 8445, 8086, 8087, 9000, 9500, 11080, 50010)

    [switch] $IsWindows10
    [switch] $Is64Bit
    [switch] $IsPlatformX64
    [uint64] $TotalMemory
    [uint64] $CPUCount
    [uint64] $FreeHdd
    [Object[]] $OpenPorts = @()
    [switch] $IsGreengrassInstalled
    [switch] $IsJava11Installed
    [switch] $IsPython3Installed

    EnvironmentInfo() {
        Write-Info "Gathering environment info ..."
        $InstallPath = Get-Variable InstallPath -ValueOnly
        $InstallPathFull = [IO.Path]::GetFullPath($InstallPath)

        $computerInfo = Get-ComputerInfo 
        $this.IsWindows10 = [Environment]::OSVersion.Platform -eq "Win32NT" -And [Environment]::OSVersion.Version.Major -ge 10
        $this.Is64Bit = [Environment]::Is64BitProcess -And [Environment]::Is64BitOperatingSystem 
        $this.IsPlatformX64 = (Get-WmiObject -Class Win32_ComputerSystem -ErrorAction SilentlyContinue).SystemType -match 'x64'
        $this.TotalMemory = $computerInfo.CsTotalPhysicalMemory
        $this.CPUCount = (Get-CimInstance -Class CIM_Processor -ErrorAction SilentlyContinue).NumberOfCores
        $this.FreeHdd = (Get-Volume -FilePath $InstallPathFull -ErrorAction SilentlyContinue).SizeRemaining
        $this.OpenPorts = (Get-NetTCPConnection |`
                Where-Object Localport -in $this.RequiredPorts | Select-Object Localport).Localport |`
                Sort | Get-Unique
        $this.IsGreengrassInstalled = $null -ne (Get-Service -Name greengrass -errorAction SilentlyContinue)
        $this.IsJava11Installed = (Get-Command java -errorAction SilentlyContinue).version.major -eq 11
        $this.IsPython3Installed = (Get-Command python -errorAction SilentlyContinue).version.major -eq 3
        
        $error.clear()
    }

    EnvironmentInfo([switch] $IsWindows10, [switch] $Is64Bit, [switch] $IsPlatformX64, `
            [uint64] $TotalMemory, [uint64] $CPUCount, [uint64] $FreeHdd, [Object[]]$OpenPorts, `
            [switch] $IsGreengrassInstalled, [switch] $IsJava11Installed, [switch] $IsPython3Installed) {
        
        $this.IsWindows10 = $IsWindows10
        $this.Is64Bit = $Is64Bit
        $this.IsPlatformX64 = $IsPlatformX64
        $this.TotalMemory = $TotalMemory
        $this.CPUCount = $CPUCount
        $this.FreeHdd = $FreeHdd
        $this.OpenPorts = $OpenPorts
        $this.IsGreengrassInstalled = $IsGreengrassInstalled
        $this.IsJava11Installed = $IsJava11Installed
        this.IsPython3Installed = $IsPython3Installed
    }
}

class ValidateEnvironment {
    hidden [switch] $HasWarning = $false
    hidden [EnvironmentInfo] $EnvironmentInfo;
    hidden [switch] $EnableDataProcessingPack;
        
    ValidateEnvironment([EnvironmentInfo] $EnvironmentInfo, [switch] $EnableDataProcessingPack) {
        $this.EnvironmentInfo = $EnvironmentInfo
        $this.EnableDataProcessingPack = $EnableDataProcessingPack
    }

    hidden [void] WriteWarning([string] $warning) {
        Write-Warning $warning
        $this.HasWarning = $true
    }

    hidden [void]ValidateOs() {
        if (-Not $this.EnvironmentInfo.IsWindows10) {
            $this.WriteWarning("SiteWise Edge PowerShell install bundle requires Windows 10 and later.")
        }
    }

    hidden [void]Validate64Bit() {
        if (-Not $this.EnvironmentInfo.Is64Bit) {
            $this.WriteWarning("SiteWise Edge gateway currently supports only 64bit runtime environment.")
        }
    }

    hidden [void]ValidatePlatform() {
        if (-Not $this.EnvironmentInfo.IsPlatformX64) {
            $this.WriteWarning("SiteWise Edge gateway currently supports only x86_64 architecture.")
        }
    }

    hidden [void]ValidateMemory() {
        if ($this.EnvironmentInfo.TotalMemory -lt 32000000000) {
            $this.WriteWarning("SiteWise Edge data processing pack requires at least 32GB of memory.")
        }
    }

    hidden [void]ValidateCores() {
        if ($this.EnvironmentInfo.CPUCount -lt 4) {
            $this.WriteWarning("Your processor may not be powerful enough to run SiteWise Edge.")
        }
    }

    hidden [void]ValidateStorage() {
        if ($this.EnvironmentInfo.FreeHdd -lt 161061273600) {
            $this.WriteWarning("SiteWise Edge data processing pack requires at least 150GB of storage in the root partition.")
        }
    }

    hidden [void]ValidatePorts() {
        if ($this.EnvironmentInfo.OpenPorts.Count -ne 0) {
            $this.WriteWarning("SiteWise Edge data processing pack requires the use of currently occupied port(s): " +
                "$($this.EnvironmentInfo.OpenPorts -join ", ")")
        }
    }

    hidden [void]ValidateGreengrass() {
        if ($this.EnvironmentInfo.IsGreengrassInstalled) {
            $this.WriteWarning("Greengrass service has been detected, this may cause errors with SiteWise Edge.")
        }
    }

    hidden [void]ValidateJava() {
        if (-not $this.EnvironmentInfo.IsJava11Installed) {
            $this.WriteWarning("Java 11 is missing and will be installed.")
        }
    }

    [void]Validate() {
        $this.HasWarning = $false
        $HardwareMessage = ""

        $this.ValidateOs();
        $this.Validate64Bit();
        $this.ValidatePlatform();
        
        if ($this.EnableDataProcessingPack -eq $true) {
            $this.ValidateMemory();
            $this.ValidateCores();
            $this.ValidateStorage();
            $this.ValidatePorts();
        }

        $this.ValidateGreengrass();
        if ($this.HasWarning) {
            $HardwareMessage = "`nYour hardware does not meet SiteWise Edge gateway system requirements and may not function properly.`n";
        }

        $this.ValidateJava();
        
        if ($this.HasWarning) {
            ConfirmAction($HardwareMessage + "`nDo you wish to proceed with the installation?")
        }

    }
}

class Paths {
    [string] $TempFolder
    [string] $NucleusInstallerPath
    [string] $NucleusConfigPath
    [string] $JavaInstallerPath
    [string] $PythonInstallerPath
    [string] $GreengrassPath
    [string] $CertificateFilePath
    [string] $PrivateKeyPath
    [string] $RootCaPath

    Paths() {
        if ($null -eq $Env:Temp) {
            $Env:Temp = './'
        }
        $TempPath = `
            (Join-Path $Env:Temp "swe-install-$(Get-Date -f 'yyyyMMddHHmmss')-$((New-Guid).ToString().Substring(0,8))")
        $InstallPath = Get-Variable InstallPath -ValueOnly
        $this.SetPaths($TempPath, $InstallPath)
    }

    Paths([string] $TempFolder, [string] $InstallPath) {
        $this.SetPaths($TempFolder, $InstallPath)
    }

    hidden [void] SetPaths([string] $TempFolder, [string] $InstallPath) {
        $this.TempFolder = $TempFolder

        $this.NucleusInstallerPath = Join-Path $TempFolder "greengrass-$([ScriptConstants]::GreengrassNucleusVersion)"
        $this.NucleusConfigPath = Join-Path $TempFolder config.yaml

        $this.JavaInstallerPath = Join-Path $TempFolder amazon-corretto-11-x64-windows-jdk.msi

        $this.PythonInstallerPath = Join-Path $TempFolder python.exe

        $this.GreengrassPath = $InstallPath
        $this.CertificateFilePath = Join-Path $InstallPath device.pem.crt
        $this.PrivateKeyPath = Join-Path $InstallPath private.pem.key
        $this.RootCaPath = Join-Path $InstallPath AmazonRootCA1.pem
    }
}

class ArtifactUri {
    static [ArtifactUri] $AmazonRootCAUrl = [ArtifactUri]::new("Amazon Root Certificate", "https://www.amazontrust.com/repository/AmazonRootCA1.pem")
    static [ArtifactUri] $GreengrassNucleusUrl = [ArtifactUri]::new("Greengrass Nucleus" , "https://d2s8p88vqu9w66.cloudfront.net/releases/greengrass-$([ScriptConstants]::GreengrassNucleusVersion).zip")
    static [ArtifactUri] $JavaUrl = [ArtifactUri]::new("Amazon Corretto JDK 11" ,"https://corretto.aws/downloads/latest/amazon-corretto-11-x64-windows-jdk.msi")
    static [ArtifactUri] $PythonUrl = [ArtifactUri]::new("Python 3", "https://www.python.org/ftp/python/$([ScriptConstants]::PythonVersion)/python-$([ScriptConstants]::PythonVersion)-amd64.exe")

    [string] $ArtifactName
    [string] $Uri

    ArtifactUri($artifactName, $uri) {
        $this.ArtifactName = $artifactName
        $this.Uri = $uri
    }
}

class Artifacts {
    hidden [Paths] $Paths;
    hidden [switch] $IsJavaInstalled;
    hidden [switch] $IsPython3Installed;

    Artifacts([Paths] $Paths, [switch] $IsJavaInstalled, [switch] $IsPython3Installed) {
        $this.Paths = $Paths
        $this.IsJavaInstalled = $IsJavaInstalled
        $this.IsPython3Installed = $IsPython3Installed
    }

    [void] DownloadArtifacts() {
        $this.CreateFolderIfNotExists($this.Paths.GreengrassPath)
        $this.CreateFolderIfNotExists($this.Paths.TempFolder)

        $this.DownloadFile([ArtifactUri]::AmazonRootCAUrl, $this.Paths.RootCaPath)
        $this.DownloadAndUnzipFile([ArtifactUri]::GreengrassNucleusUrl, $this.Paths.NucleusInstallerPath)
        if (-not $this.IsJavaInstalled) {
            $this.DownloadFile([ArtifactUri]::JavaUrl, $this.Paths.JavaInstallerPath)
        }
        if (-not $this.IsPython3Installed) {
            $this.DownloadFile([ArtifactUri]::PythonUrl, $this.Paths.PythonInstallerPath)
        }
    }
    
    [void] InstallJava() {
        if (-not $this.IsJavaInstalled) {
            $TempFile = Join-Path $($this.Paths.TempFolder) "$((New-TemporaryFile).Name).log"
            [Object[]] $Arguments = @("/I `"$($this.Paths.JavaInstallerPath)`"", "/QN", "/L*V+ `"$TempFile`"")
            
            Write-Info "Installing Java 11 ..."
            $Process = Start-Process  "msiexec" -ArgumentList $Arguments -Wait -PassThru
            if ($Process.ExitCode -ne 0) {
                Write-Error "Failed to install Java 11, see '$TempFile' log for details"
                ExitScript
            }
            else {
                ReloadPath
            }
        }
    }

    [void] InstallPython() {
        if (-not $this.IsPython3Installed) {
            Write-Info "Installing Python 3 ..."
            $Output = ""
            try {
                $Output = & $($this.Paths.PythonInstallerPath) /quiet PrependPath=1 InstallAllUsers=1 TargetDir=C:\Python DefaultAllUsersTargetDir=C:\Python DefaultCustomTargetDir=C:\Python | Out-String 
            } catch {
                LogError $_
                Write-Error "($Output)"
                Write-Error "Failed to install Python 3, see above for install output"
                ExitScript
            }
        }
    }

    hidden [void] DownloadFile([ArtifactUri] $ArtifactUri, [string] $OutFile) {
        try {
            Write-Info "Downloading $($ArtifactUri.ArtifactName) ..."
            Invoke-WebRequest -Uri $ArtifactUri.Uri -OutFile $OutFile -ErrorAction Stop
        }
        catch { 
            Write-Error "Failed to download the file from $($ArtifactUri.Uri) to $OutFile"
            LogError $_
            throw
        } 
    }

    hidden [void] DownloadAndUnzipFile([ArtifactUri] $ArtifactUri, [string] $OutFile) {
        $TempFile = Join-Path $($this.Paths.TempFolder) "$((New-TemporaryFile).Name).zip"
        $this.DownloadFile($ArtifactUri, $TempFile)
        
        try {
            Write-Info "Expanding $($ArtifactUri.ArtifactName) ..."
            Expand-Archive -Path $TempFile -DestinationPath $OutFile -ErrorAction Stop
        }
        catch { 
            Write-Error "Failed to extract the file from $($ArtifactUri.Uri) to $OutFile"
            LogError $_
            throw
        } 
    }

    hidden [void] CreateFolderIfNotExists([string] $path) {
        if (-not(Test-Path $path) ) {
            try { 
                Write-Debug "Creating folder $path"
                New-Item -Type Directory -Path $path -ErrorAction Stop
            }
            catch {
                Write-Error "Failed to create folder $path"
                LogError $_
                throw
            }
        }
    }
}

function ExitScript {
    exit 1
}

function ConfirmAction {
    param (
        [parameter(Mandatory = $true)]
        [string]$Message
    )

    if (-Not $Yes) {
        $confirmation = Read-Host "$Message [y/N]"
        if ($confirmation -notmatch '^([yY][eE][sS]|[yY])$') {
            ExitScript
        }
    }
}

class UserManagement {
    [void] AddGreengrassUser([string] $User, [string] $Pass) {
        try {
            if (-Not($this.UserExists($User))) {
                Write-Info "Registering user $User"
                $this.AddUser($User, $Pass)
                $this.RegisterSystemCreds($User, $Pass)
            }
            else {
                Write-Warning ("User '$User' already exists and is assumed to be setup. To re-create the user visit: " + `
                        "https://docs.aws.amazon.com/greengrass/v2/developerguide/configure-greengrass-core-v2.html#configure-component-user")
            }
        }
        catch {
            Write-Error "Failed to add user '$User'"
            LogError $_
            throw
        }
    }

    hidden [switch] UserExists([string] $User) {
        return $null -ne $(Get-LocalUser -name $User -ErrorAction SilentlyContinue)
    }

    hidden [void] AddUser([string] $User, [string] $Pass) {
        $SecurePass = ConvertTo-SecureString -string $Pass -AsPlainText -Force -ErrorAction Stop
        New-LocalUser -Name $User -Description "Greengrass Core user" -Password $SecurePass `
            -PasswordNeverExpires -UserMayNotChangePassword -ErrorAction Stop

    }

    hidden [void] RegisterSystemCreds([string] $User, [string] $Pass) {
        $code = ExecuteAsSystem -ScriptBlock { 
            $gccuser = $args[0]
            $gccpass = $args[1]
            cmdkey /generic:$gccuser /user:$gccuser /pass:`"$gccpass`" *> $null
            $?
        } -Arguments @($User, $Pass)

        if ($code -ne $true) {
            throw "Failed to register system credential for $User"
        }
    }
}

class GreengrassNucleus {
    hidden [Paths] $Paths
    hidden [string] $User

    GreengrassNucleus([Paths] $Paths, [string] $User) {
        $this.Paths = $Paths
        $this.User = $User
    }

    [void] InstallGreengrass() {
        try {
            $configFileData = $this.GetNucleusConfig()
            
            Set-Content -Path $this.Paths.NucleusConfigPath -Value $configFileData -ErrorAction Stop
            Set-Content -Path $this.Paths.CertificateFilePath -Value $([ScriptConstants]::IotCertificatePem) -ErrorAction Stop
            Set-Content -Path $this.Paths.PrivateKeyPath -Value $([ScriptConstants]::IotPrivateKey) -ErrorAction Stop

            $this.OpenHTTPSPort()
            $this.InstallNucleus()

        }
        catch {
            Write-Error "Failed to install Greengrass Nucleus"
            LogError $_
            throw
        }
    }

    hidden [string] GetNucleusConfig() {
        $certificateFilePath = ($this.Paths.CertificateFilePath -replace "\\", "\\\\")
        $privateKeyPath = ($this.Paths.PrivateKeyPath -replace "\\", "\\\\")
        $rootCaPath = ($this.Paths.RootCaPath -replace "\\", "\\\\")
        $rootpath = ($this.Paths.GreengrassPath -replace "\\", "\\\\")
    
        $configFileData = @"
---
system:
  certificateFilePath: "$certificateFilePath"
  privateKeyPath: "$privateKeyPath"
  rootCaPath: "$rootCaPath"
  rootpath: "$rootpath"
  thingName: "$([ScriptConstants]::IotThingName)"
services:
  aws.greengrass.Nucleus:
    componentType: "NUCLEUS"
    configuration:
      awsRegion: "$([ScriptConstants]::AwsRegion)"
      iotRoleAlias: "$([ScriptConstants]::IotRoleAlias)"
      iotDataEndpoint: "$([ScriptConstants]::IotDataEndpoint)"
      iotCredEndpoint: "$([ScriptConstants]::IotCredentialEndpoint)"
"@

        return $configFileData
    }

    hidden [void] InstallNucleus() {
        $NucleusJarPath = Join-Path $this.Paths.NucleusInstallerPath "/lib/Greengrass.jar"
    
        Write-Info "Installing Greengrass Nucleus ..."
        java -Droot="$($this.Paths.GreengrassPath)" "-Dlog.store=FILE" `
            -jar $NucleusJarPath `
            --init-config $this.Paths.NucleusConfigPath `
            --component-default-user $this.User `
            --setup-system-service true	
                  
        if ($? -ne $true) {
            throw "Failed to install Greengrass nucleus"
        }
    }

    hidden [void] OpenHTTPSPort() {
        Write-Info "Adding firewall rule to allow HTTPS access to the gateway ..."
        try {
            New-NetFirewallRule -DisplayName 'HTTPS' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 -ErrorAction Stop
        }
        catch {
            Write-Warning "Failed to open HTTPS (443) port required to access the gateway, please open it manually"
        }
    }
}

class Factory {
    static [Factory] $Instance

    [EnvironmentInfo] $EnvironmentInfo
    [Paths] $Paths
    [UserManagement] $UserManagement
    [ValidateEnvironment] $ValidateEnvironment
    [Artifacts] $Artifacts
    [GreengrassNucleus] $GreengrassNucleus

    static [void] Init() {
        [Factory] $Factory = [Factory]::new()
        
        $GGCUser = Get-Variable GGCUser -ValueOnly

        $Factory.EnvironmentInfo = [EnvironmentInfo]::new()
        $Factory.Paths = [Paths]::new()

        LogInfo "Environment Info:"
        LogInfo $Factory.EnvironmentInfo
        
        LogInfo "Paths:"
        LogInfo $Factory.Paths
    
        $Factory.UserManagement = [UserManagement]::new()
    
        $Factory.ValidateEnvironment = [ValidateEnvironment]::new($Factory.EnvironmentInfo, `
                [ScriptConstants]::IsDataProcessingPackEnabled())
        $Factory.Artifacts = [Artifacts]::new($Factory.Paths, $Factory.EnvironmentInfo.IsJava11Installed, $Factory.EnvironmentInfo.IsPython3Installed)
        $Factory.GreengrassNucleus = [GreengrassNucleus]::new($Factory.Paths, $GGCUser)

        [Factory]::Instance = $Factory
    }
}

function ReloadPath {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" `
            + [System.Environment]::GetEnvironmentVariable("Path","User")
}

function ExecuteAsSystem([ScriptBlock] $ScriptBlock, [Object[]] $Arguments) {
    [guid] $Name = New-Guid

    try {
        $ScheduledJobOption = New-ScheduledJobOption -RunElevated
        $ScheduledJob = Register-ScheduledJob -Name $Name -ScheduledJobOption $ScheduledJobOption -ScriptBlock $ScriptBlock -ArgumentList $Arguments -ErrorAction Stop
        try {
            $ScheduledTaskAction = New-ScheduledTaskAction -Execute $ScheduledJob.PSExecutionPath -Argument $ScheduledJob.PSExecutionArgs -ErrorAction SilentlyContinue
            $ScheduledTaskPrincipal = New-ScheduledTaskPrincipal -UserID 'NT AUTHORITY\SYSTEM' -LogonType ServiceAccount -RunLevel Highest -ErrorAction SilentlyContinue
            $ScheduledTask = Register-ScheduledTask -TaskName $Name -Action $ScheduledTaskAction  -Principal $ScheduledTaskPrincipal -ErrorAction Stop
            $ScheduledTask | Start-ScheduledTask -AsJob -ErrorAction Stop | Wait-Job | Remove-Job -Force -Confirm:$False -ErrorAction Stop
            
            While (($ScheduledTask | Get-ScheduledTaskInfo).LastTaskResult -eq 267009) {
                Start-Sleep -Milliseconds 100 
            }
            
            $Job = Get-Job -Name $Name -ErrorAction SilentlyContinue | Wait-Job
            $Result = $Job | Receive-Job -Wait -AutoRemoveJob
        }
        finally {
            $ScheduledTask | Unregister-ScheduledTask -Confirm:$false
        }
    }
    finally {
        $ScheduledJob | Unregister-ScheduledJob -Force -Confirm:$False
    }

    return $Result
}

function Init {
    $error.clear()
    
    # enable logging
    [Logger]::Init()

    # Initialize the factory
    [Factory]::Init()

    Write-Info "The SiteWise Edge installation log is available at: $([Logger]::Filename)"

    # turn of iwr progress bar, speeds up downloads significantly
    $script:ProgressPreference = 'SilentlyContinue'

    # network settings
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls -bor `
        [Net.SecurityProtocolType]::Tls11 -bor `
        [Net.SecurityProtocolType]::Tls12

    # ensure random password if one was not set
    if ([string]::IsNullOrEmpty($GGCUserPass)) {
        Add-Type -AssemblyName 'System.Web'
        $script:GGCUserPass = [System.Web.Security.Membership]::GeneratePassword(12, 2)
    }
}

function Main {
    Init
    $userManagement = [Factory]::Instance.UserManagement
    $validateEnv =  [Factory]::Instance.ValidateEnvironment
    $artifacts = [Factory]::Instance.Artifacts
    $greengrassNucleus = [Factory]::Instance.GreengrassNucleus
    
    $userManagement.AddGreengrassUser($GGCUser, $GGCUserPass)
    $validateEnv.Validate()
    $artifacts.DownloadArtifacts()
    $artifacts.InstallJava()
    $artifacts.InstallPython()
    $greengrassNucleus.InstallGreengrass()
    
    Write-Info "Done!"
}

if ($null -eq $____Pester) {
    try {
        Main
    }
    catch {
        Write-Error "Setup Failed!"
        LogError $_
    }
}
 
 
 
