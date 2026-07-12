<#
.SYNOPSIS
  Keep asking Oracle for an Always Free ARM instance until one is actually free.

.DESCRIPTION
  Oracle's Always Free Ampere (A1.Flex) capacity is chronically exhausted - Create
  fails with "Out of capacity for shape VM.Standard.A1.Flex in availability domain
  AD-1". Capacity DOES free up as other tenants release instances; you simply have
  to be asking at the moment it does. Clicking Create in the console is a poor way
  to win that race, and it gets you rate-limited ("Too many requests for the user"),
  which makes things worse.

  This polls patiently instead. Each cycle it tries the shape sizes largest-first
  and falls back, so you end up with the biggest instance that's actually available
  rather than settling early. It backs off hard on rate limits and stops the moment
  an instance exists.

  Leave it running. Overnight is fine. This is the normal way people get ARM capacity.

.PREREQUISITES
  1. OCI CLI:
       Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
       Invoke-WebRequest https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.ps1 -OutFile install.ps1
       .\install.ps1
  2. Authenticate:
       oci setup config
     Then upload the generated public key in the Oracle Console:
       Profile (top-right) -> User settings -> API keys -> Add API key
       -> paste the contents of $HOME\.oci\oci_api_key_public.pem
  3. An SSH PUBLIC key (.pub) to install on the instance. Either the one you
     downloaded from the console, or: ssh-keygen -t ed25519 -f $HOME\.ssh\lucid

.EXAMPLE
  .\oracle-grab-arm.ps1 -SshPublicKeyPath "$HOME\.ssh\lucid.key.pub"
#>

[CmdletBinding()]
param(
    # PUBLIC key (.pub) installed on the instance so you can SSH in afterwards.
    [Parameter(Mandatory = $true)]
    [string]$SshPublicKeyPath,

    # The PUBLIC subnet from the VCN wizard. A private subnet has no internet
    # gateway route, so the instance would boot unreachable.
    [string]$SubnetName = "public subnet-lucid-vcn",

    [string]$DisplayName = "lucid-101",

    # Defaults to the root compartment (which is the tenancy itself).
    [string]$CompartmentId,

    # Minutes between cycles. Don't drop below ~2 - Oracle will rate-limit you and
    # you'll win the race less often, not more.
    [int]$CycleWaitMinutes = 5
)

$ErrorActionPreference = "Stop"

# Largest first: if a big slot happens to be free, take it. All three are inside
# the Always Free allowance (4 OCPU / 24 GB total), so none of them bill.
$Shapes = @(
    @{ Ocpus = 4; MemoryGb = 24 },
    @{ Ocpus = 2; MemoryGb = 12 },
    @{ Ocpus = 1; MemoryGb = 6  }
)

function Write-Step($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Write-Ok($m)   { Write-Host "    $m" -ForegroundColor Green }
function Write-Note($m) { Write-Host "    $m" -ForegroundColor Yellow }

if (-not (Get-Command oci -ErrorAction SilentlyContinue)) {
    throw "OCI CLI not found. Install it first (see PREREQUISITES at the top of this file)."
}
if (-not (Test-Path $SshPublicKeyPath)) {
    throw "SSH public key not found at $SshPublicKeyPath"
}

# -- Resolve OCIDs so you never have to paste one by hand ---------------------

Write-Step "Resolving tenancy, image and subnet..."

if (-not $CompartmentId) {
    # A compartment's parent ("compartment-id") is the tenancy = root compartment.
    $CompartmentId = oci iam compartment list --all --query 'data[0]."compartment-id"' --raw-output
    if (-not $CompartmentId) { throw "Couldn't resolve a compartment. Has 'oci setup config' been run?" }
}
Write-Ok "Compartment: $CompartmentId"

$AvailabilityDomain = oci iam availability-domain list --compartment-id $CompartmentId --query 'data[0].name' --raw-output
Write-Ok "Availability domain: $AvailabilityDomain"

# Filtering by --shape gets the aarch64 build. The x86 image will not boot on Ampere.
$ImageId = oci compute image list `
    --compartment-id $CompartmentId `
    --operating-system "Canonical Ubuntu" `
    --operating-system-version "24.04" `
    --shape "VM.Standard.A1.Flex" `
    --sort-by TIMECREATED --sort-order DESC `
    --query 'data[0].id' --raw-output
if (-not $ImageId) { throw "Couldn't find an ARM-compatible Ubuntu 24.04 image." }
Write-Ok "Image: $ImageId"

$subnetQuery = 'data[?"display-name"==''' + $SubnetName + '''].id | [0]'
$SubnetId = oci network subnet list --compartment-id $CompartmentId --all --query $subnetQuery --raw-output
if (-not $SubnetId -or $SubnetId -eq "null") {
    Write-Note "No subnet named '$SubnetName'. Available subnets:"
    oci network subnet list --compartment-id $CompartmentId --all --query 'data[]."display-name"' --output table
    throw "Re-run with the right -SubnetName."
}
Write-Ok "Subnet: $SubnetId"

$SshKey     = (Get-Content $SshPublicKeyPath -Raw).Trim()
$MetadataJs = @{ ssh_authorized_keys = $SshKey } | ConvertTo-Json -Compress

# -- The grind ----------------------------------------------------------------

$cycle = 0; $attempts = 0
$started = Get-Date

Write-Host ""
Write-Step "Hunting A1.Flex capacity. Ctrl+C to stop - otherwise just leave it running."
Write-Host ""

while ($true) {
    $cycle++

    foreach ($shape in $Shapes) {
        $attempts++
        $label = "$($shape.Ocpus) OCPU / $($shape.MemoryGb) GB"
        Write-Host ("[{0}] cycle {1} | try {2} | {3} ... " -f (Get-Date).ToString("HH:mm:ss"), $cycle, $attempts, $label) -NoNewline

        $shapeConfig = @{ ocpus = $shape.Ocpus; memoryInGBs = $shape.MemoryGb } | ConvertTo-Json -Compress

        $raw = oci compute instance launch `
            --availability-domain $AvailabilityDomain `
            --compartment-id $CompartmentId `
            --shape "VM.Standard.A1.Flex" `
            --shape-config $shapeConfig `
            --image-id $ImageId `
            --subnet-id $SubnetId `
            --assign-public-ip true `
            --display-name $DisplayName `
            --metadata $MetadataJs `
            --wait-for-state RUNNING 2>&1 | Out-String

        if ($LASTEXITCODE -eq 0) {
            Write-Host "SUCCESS" -ForegroundColor Green
            Write-Host ""
            $mins = [int]((Get-Date) - $started).TotalMinutes
            Write-Step "RUNNING as $label - after $attempts attempts, $mins min."

            try {
                $instanceId = ($raw | ConvertFrom-Json).data.id
                $ip = oci compute instance list-vnics --instance-id $instanceId --query 'data[0]."public-ip"' --raw-output
                Write-Ok "Public IP: $ip"
                Write-Host ""
                Write-Host "SSH in with:" -ForegroundColor Cyan
                Write-Host "  ssh -i `$HOME\.ssh\lucid.key ubuntu@$ip"
            } catch {
                Write-Note "Created, but couldn't read the public IP - grab it from the console."
            }

            Write-Host ""
            Write-Host "Next: DEPLOYMENT.md, from 'Open ports'." -ForegroundColor Cyan
            return
        }

        if ($raw -match "Out of capacity|OutOfCapacity") {
            Write-Host "no capacity" -ForegroundColor DarkGray
        }
        elseif ($raw -match "TooManyRequests|Too many requests|429") {
            # Backing off properly IS the strategy. Hammering extends the throttle
            # and never wins the capacity race.
            Write-Host "rate limited - backing off 15 min" -ForegroundColor Yellow
            Start-Sleep -Seconds 900
        }
        elseif ($raw -match "LimitExceeded|QuotaExceeded") {
            Write-Host "QUOTA" -ForegroundColor Red
            Write-Note "You're at your Always Free limit - you may already have an ARM instance. Check the console."
            Write-Host $raw
            return
        }
        else {
            # An error we don't recognise deserves your eyes, not a retry loop.
            Write-Host "ERROR" -ForegroundColor Red
            Write-Host $raw
            return
        }

        Start-Sleep -Seconds 30    # brief gap between shape sizes
    }

    Write-Host ("[{0}] nothing free at any size - sleeping {1} min" -f (Get-Date).ToString("HH:mm:ss"), $CycleWaitMinutes) -ForegroundColor DarkGray
    Start-Sleep -Seconds ($CycleWaitMinutes * 60)
}
