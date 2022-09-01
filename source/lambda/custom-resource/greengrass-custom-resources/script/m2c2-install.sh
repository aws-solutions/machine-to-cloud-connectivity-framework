#!/usr/bin/env bash

GREENGRASS_FOLDER="/greengrass"

AWS_REGION='REGION_PLACEHOLDER'
IOT_THING_NAME='THING_NAME_PLACEHOLDER'
IOT_ROLE_ALIAS='ROLE_ALIAS_PLACEHOLDER'
IOT_DATA_ENDPOINT='DATA_ENDPOINT_PLACEHOLDER'
IOT_CRED_ENDPOINT='CRED_ENDPOINT_PLACEHOLDER'
IOT_CERTIFICATE_PEM='CERTIFICATE_PEM_PLACEHOLDER'
IOT_PRIVATE_KEY='PRIVATE_KEY_PLACEHOLDER'
ENABLE_DATA_PROCESSING_PACK='false'

VERSION='1.0.82.0'
GREENGRASS_NUCLEUS_VERSION='2.5.6'

GREENGRASS_NUCLEUS_VERSION='2.5.6'

function printUsage() {
  cat 1>&2 <<EOF
Installs and configures SiteWise Edge and the associated Greengrass software and permissions.

USAGE:
    sudo $0 [-h, -y, -e]

    Install in interactive mode:
    sudo $0

    Run non-interactively and assume yes to all prompts:
    sudo $0 -y

OPTIONS:
    -y, --yes                       Run non-interactively and assume yes to all prompts.

    -e, --export-config             Export Greengrass Core configuration file for manual
                                    installation. No software will be installed.

    -v, --verbose                   Print output from all commands

    -h, --help                      Prints help information

Version: $VERSION
EOF
    exit 0
}

function parseCommandLine() {
    unset PKG_MGR
    unset VALIDATION_ERROR
    unset VERBOSE_MODE
    unset EXPORT_CONFIG

    INTERACTIVE_MODE=true

    while [ "$#" -gt 0 ]
    do
        case "$1" in
            -y | --yes)
                INTERACTIVE_MODE=false
                ;;
            -e | --export-config)
                EXPORT_CONFIG=true
                ;;
            -v | --verbose)
                VERBOSE_MODE=true
                ;;
            -h | --help)
                printUsage
                ;;
            *)
                showWarning "Unknown option $1"
                printf "\n\nFor help run:\n$0 --help\n\n"
                exit 1
                ;;
        esac
        shift
    done
}

function setupLogging() {
    local log_file="$(dirname $(mktemp -u))/swe-install-$(date +'%Y%m%d%H%M%S').log"
    touch ${log_file}

    echo "The SiteWise Edge installation log is available at: ${log_file}"

    # store the stdout descriptor for redirect
    exec 5>&1
    # quiet logging
    exec 4> >(sed "s/^/$(date '+[%F %T]'): /" >> ${log_file})
    # stdout and then log
    exec 1> >(tee /dev/fd/5 1>&4)

    # print errors and hidden messages in verbose mode
    if [[ $VERBOSE_MODE == true ]]
    then
        exec 3>&1 2>&1
    else
        exec 3>&4 2>&4
    fi
}

function logOuput() {
    "$@" >&3
}

function isSuperUser() {
    [ "$EUID" -eq 0 ]
}

function isLinux() {
    [[ "$OSTYPE" == "linux"* ]]
}

function isPortOccupied() {
    ss -lnt | grep ':$1 ' > /dev/null
}

function unzipExists() {
    command -v unzip &> /dev/null
}

function javaExists() {
    local java_version=$(java -version 2>&1 | grep -i version | cut -d'"' -f2)
    local required_version_regex='^11\..*$'
    [[ $java_version =~ $required_version_regex ]]
}

function python3Exists() {
    which python3 > /dev/null 2>&1
    return $?
}

function pip3Exists() {
    which pip3 > /dev/null 2>&1
    return $?
}

function existsInFile() {
    grep -qe $1 $2 2>/dev/null
}

function getInput {
    read "$@"
}

function getHardwareSpecs() {
   ARCHITECTURE=$(uname -m)
   TOTAL_MEM=$(awk '/^MemTotal:/{print $2}' /proc/meminfo)
   FREE_HDD=$(df --output=avail -k / | sed 1d)
   CPU_COUNT=$(nproc --all)
}

function getOperatingSystem() {
    unset OS_ID
    unset OS_VERSION
    unset OS_NAME

    # we only support linux version with /etc/os-release present
    if [ -r /etc/os-release ]; then
        # load the variables in os-release
        . /etc/os-release
        OS_ID=$ID
        OS_VERSION_ID=$VERSION_ID
        OS_NAME=$NAME
    fi
}

function confirmAction {
    if [[ $INTERACTIVE_MODE == true ]]
    then
        printf "$1 [y/N] "
        getInput response
        if ! [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]
        then
            exit 1
        fi
    fi
}

function showWarning() {
    echo -e "\e[93mWarning:\e[0m $*"
}

function showError() {
    echo -e "\e[91mError:\e[0m $*"
    exit 1
}

function showWarningOnFailure() {
    if [[ $? -ne 0 ]]
    then
        showWarning "$*"
    fi
}

function showErrorOnFailure() {
    if [[ $? -ne 0 ]]
    then
        showError "$*"
    fi
}

function showValidationWarning() {
    showWarning "$*"
    VALIDATION_ERROR=true
}

function validatePermissions() {
    if ! isSuperUser; then
        showError "This script needs root permissions to execute. Please run this script as root."
    fi
}

function validateRuntimeEnvironment() {
    if ! isLinux;
    then
        showError "SiteWise Edge currently only supports Linux based operating systems"
    fi

    # retrieve OS details
    getOperatingSystem
}

# Usage: versionCheck <min_version> <actual_version>
function versionCheck() {
    version() { echo "$@" | awk -F. '{ printf("%d%03d%03d%03d\n", $1,$2,$3,$4); }'; }

    local min_version="${1:-0}"
    local actual_version="${2:-0}"

    if  [ $(version $actual_version) -lt $(version $min_version) ]
    then
        return 0
    fi

    return 1
}

function validateOperatingSystem() {
    declare -A min_versions
    min_versions[amzn]=2
    min_versions[ubuntu]=18.04
    min_versions[rhel]=8.0

    if [[ -z ${min_versions[$OS_ID]} ]]
    then
        showValidationWarning "SiteWise Edge does not currently support ${OS_NAME:-this} operating system"
    elif versionCheck ${min_versions[$OS_ID]} $OS_VERSION_ID;
    then
        showValidationWarning "SiteWise Edge requires $OS_NAME version ${min_versions[$OS_ID]} and higher"
    fi

    # for testing
    [[ $VALIDATION_ERROR == true ]] && return 1 || return 0
}

function validateReservedPorts() {
    local reserved_ports=(80 443 3001 8000 8081 8082 8084 8085 8445 8086 9000 9500 11080)
    local occupied_ports=()

    for port in "${reserved_ports[@]}"
    do
        if isPortOccupied $port;
        then
            occupied_ports+=($port)
        fi
    done

    if [ ${#occupied_ports[@]} -ne 0 ]
    then
        local port_list=${occupied_ports[*]}
        showValidationWarning "SiteWise Edge data processing pack requires the use of currently occupied port(s): ${port_list// /, }"
    fi
}

function validateHardware() {
    getHardwareSpecs

    if [ $ARCHITECTURE != "x86_64" ]
    then
        showValidationWarning "SiteWise Edge data processing pack corrently supports only x86_64 architecture"
    fi

    if [ $TOTAL_MEM -lt 15000000 ]
    then
        showValidationWarning "SiteWise Edge data processing pack requires at least 15GB of memory"
    fi

    if [ $FREE_HDD -lt 150000000 ]
    then
        showValidationWarning "SiteWise Edge data processing pack requires at least 150GB of storage in the root partition"
    fi

    if [ $CPU_COUNT -lt 4 ]
    then
        showValidationWarning "Your processor may not be powerful enough to run SiteWise Edge"
    fi
}

function validateDataProcessingPackRequirements() {
    if [[ $ENABLE_DATA_PROCESSING_PACK == true ]]
    then
        validateHardware
        validateOperatingSystem
        validateReservedPorts

        if [[ $VALIDATION_ERROR == true ]]
        then
            confirmAction "\nYour hardware does not meet SiteWise Edge data processing pack minimum system requirements and may not function properly. If you choose to continue installation you can address the warnings or remove data processing pack then restart your hardware.\n\nAcknowledge the warnings and proceed with the installation?"
        fi
    fi

    # for testing
    [[ $VALIDATION_ERROR == true ]] && return 1 || return 0
}

function createTempFolder() {
    # create temporary folder where we are storing downloads
    temp_install_dir="$(mktemp -d 2>/dev/null || mktemp -d -t 'mytmpdir')"
    # auto destroy the folder on exit
    trap 'rm -rf -- "$temp_install_dir"' EXIT
    cd $temp_install_dir
    echo "Created temporary installation directory $temp_install_dir"
}

function checkDependencies() {
    MISSING_DEPENDENCIES=()

    case $OS_ID in
        ubuntu)
            PKG_MGR=apt
            ALTERNATIVES=update-alternatives
            unzipExists ||
                MISSING_DEPENDENCIES+=(unzip)
            javaExists ||
                MISSING_DEPENDENCIES+=(openjdk-11-jre-headless)
            python3Exists ||
                MISSING_DEPENDENCIES+=(python3)
            pip3Exists ||
                MISSING_DEPENDENCIES+=(python3-pip)
            ;;
        amzn)
            PKG_MGR=yum
            ALTERNATIVES=alternatives
            unzipExists ||
                MISSING_DEPENDENCIES+=(unzip)
            javaExists ||
                MISSING_DEPENDENCIES+=(java-11-amazon-corretto-headless)
            python3Exists ||
                MISSING_DEPENDENCIES+=(python3)
            pip3Exists ||
                MISSING_DEPENDENCIES+=(python3-pip)
            ;;
        rhel)
            PKG_MGR=yum
            ALTERNATIVES=alternatives
            unzipExists ||
                MISSING_DEPENDENCIES+=(unzip)
            javaExists ||
                MISSING_DEPENDENCIES+=(java-11-openjdk-headless)
            python3Exists ||
                MISSING_DEPENDENCIES+=(python3)
            pip3Exists ||
                MISSING_DEPENDENCIES+=(python3-pip)
            ;;
        *)
            unzipExists ||
                MISSING_DEPENDENCIES+=("unzip")
            javaExists ||
                MISSING_DEPENDENCIES+=("java 11")
            python3Exists ||
                MISSING_DEPENDENCIES+=("python3")
            pip3Exists ||
                MISSING_DEPENDENCIES+=("pip3")
            ;;
    esac
}

function updatePackageManager() {
    local error_message="Failed to update package manager"
    # Only update package manager if we have missing dependencies
    if [ ${#MISSING_DEPENDENCIES[@]} -ne 0 ]
    then
        echo "Updating package manager ..."
        logOuput \
            $PKG_MGR update -y
        showWarningOnFailure $error_message
    fi
}

function configureDefaultJava() {
    local desired_java_path=$($ALTERNATIVES --display java 2>/dev/null | grep priority | cut -d " " -f1 | grep java-11)
    logOuput \
        $ALTERNATIVES --set java $desired_java_path
    showWarningOnFailure "Failed to set default java path to $desired_java_path"
}

function installDependencies() {
    checkDependencies

    if [ ${#MISSING_DEPENDENCIES[@]} -ne 0 ]
    then
        echo "Following dependencies are missing:"
        printf "* %s\n" "${MISSING_DEPENDENCIES[@]}"

        if [[ -z $PKG_MGR ]]; then
            showError "Please install dependencies and ensure they are in super user path before running installation script again."
        else
            confirmAction "\nProceed with the installation?"
        fi

        updatePackageManager

        # install missing dependencies
        for DEPENDENCY in "${MISSING_DEPENDENCIES[@]}"
        do
            echo "Installing $DEPENDENCY..."
            logOuput \
                $PKG_MGR install $DEPENDENCY -y
            showErrorOnFailure "Failed to install $DEPENDENCY, please install it manually an re-run the installation script."
        done
    fi

    configureDefaultJava
}

function modifyEtcSudoers() {
    local regex='root\s\{1,\}ALL=(ALL)\s\{1,\}ALL'
    local sudoers_file=${1:-/etc/sudoers}

    if existsInFile $regex $sudoers_file
    then
        local replacement='root    ALL=(ALL:ALL) ALL'

        echo 'Modifying /etc/sudoers to give root user permission to run sudo as other groups by replacing "root ALL=(ALL) ALL" with "root ALL=(ALL:ALL) ALL"'
        logOuput \
            sed -i "s/$regex/$replacement/" $sudoers_file
    fi
}

function downloadGreengrassNucleus() {
    local greengrass_package=greengrass-$GREENGRASS_NUCLEUS_VERSION.zip
    logOuput \
        curl --retry 10 -s https://d2s8p88vqu9w66.cloudfront.net/releases/$greengrass_package -o greengrass-package.zip
    showErrorOnFailure "Failed to download $greengrass_package. Please check your internet connection and retry."

    logOuput \
        unzip -o greengrass-package.zip -d $GREENGRASS_FOLDER/v2/GreengrassCore
    showErrorOnFailure "Failed to unzip $greengrass_package."
}

function exportConfigFileAndExit() {
    local config_path=$1
    createGreengrassConfigFile $config_path
    echo "Exported Greengrass Core configuration file: $config_path"
    exit
}

function createGreengrassConfigFile() {
    cat <<EOF > $1
---
system:
  certificateFilePath: "$GREENGRASS_FOLDER/v2/device.pem.crt"
  privateKeyPath: "$GREENGRASS_FOLDER/v2/private.pem.key"
  rootCaPath: "$GREENGRASS_FOLDER/v2/AmazonRootCA1.pem"
  rootpath: "$GREENGRASS_FOLDER/v2"
  thingName: "$IOT_THING_NAME"
services:
  aws.greengrass.Nucleus:
    componentType: "NUCLEUS"
    configuration:
      awsRegion: "$AWS_REGION"
      iotRoleAlias: "$IOT_ROLE_ALIAS"
      iotDataEndpoint: "$IOT_DATA_ENDPOINT"
      iotCredEndpoint: "$IOT_CRED_ENDPOINT"
EOF

    showErrorOnFailure "Failed to create the Greengrass configuration file $1"
}

function createGreengrassFolder() {
    logOuput \
        mkdir -p $GREENGRASS_FOLDER/v2
    showErrorOnFailure "Failed to create path $GREENGRASS_FOLDER/v2"

    logOuput \
        chmod 755 $GREENGRASS_FOLDER
    showErrorOnFailure "Failed to set the permissions to $GREENGRASS_FOLDER"
}

function installCertificates() {
    logOuput \
        curl --retry 10 -s https://www.amazontrust.com/repository/AmazonRootCA1.pem -o $GREENGRASS_FOLDER/v2/AmazonRootCA1.pem
    showErrorOnFailure "Failed to download AmazonRootCA1.pem. Please check your internet connection and retry."

    echo "${IOT_CERTIFICATE_PEM}" > $GREENGRASS_FOLDER/v2/device.pem.crt
    showErrorOnFailure "Failed to create IoT certificate file $GREENGRASS_FOLDER/v2/device.pem.crt"

    echo "${IOT_PRIVATE_KEY}" > $GREENGRASS_FOLDER/v2/private.pem.key
    showErrorOnFailure "Failed to create IoT private key $GREENGRASS_FOLDER/v2/private.pem.key"
}

function installGreengrass() {
    java -Droot="${GREENGRASS_FOLDER}/v2" -Dlog.store=FILE \
        -jar $GREENGRASS_FOLDER/v2/GreengrassCore/lib/Greengrass.jar \
        --init-config $GREENGRASS_FOLDER/v2/GreengrassCore/config.yaml \
        --component-default-user ggc_user:ggc_group \
        --setup-system-service true

    showErrorOnFailure "Failed to execute Greengrass installation"
}

function main() {
    local config_path="$GREENGRASS_FOLDER/v2/GreengrassCore/config.yaml"
    local local_config_path="${EXPORT_FOLDER-.}/config.yaml"

    parseCommandLine "$@"
    setupLogging

    if [[ $EXPORT_CONFIG == true ]]
    then
        exportConfigFileAndExit $local_config_path
    else
        # system validations
        validateRuntimeEnvironment
        validatePermissions
        validateDataProcessingPackRequirements

        createTempFolder
        installDependencies
        modifyEtcSudoers

        createGreengrassFolder
        downloadGreengrassNucleus
        createGreengrassConfigFile $config_path
        installCertificates
        installGreengrass
    fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]
then
    main "$@"
fi
