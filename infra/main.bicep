// ReqPOOL Estimation Manager — Azure infrastructure.
// Target: subscription f677fc3d-7384-4018-b5c4-204292ecadf6,
//         resource group bg_estimation_manager, region Germany West Central.
//
// az deployment group create -g bg_estimation_manager -f infra/main.bicep \
//    -p postgresAdminPassword=<secret> apiImage=<image> webImage=<image>

@description('Region for all resources')
param location string = 'germanywestcentral'

// The subscription is offer-restricted for PostgreSQL Flexible Server in
// germanywestcentral (LocationIsOfferRestricted), so the database lives in
// the nearest unrestricted EU region — still GDPR-compliant EU residency.
@description('Region for the PostgreSQL flexible server')
param postgresLocation string = 'westeurope'

@description('Container image for the API (e.g. ghcr.io/org/em-api:sha)')
param apiImage string

@description('Container image for the web frontend')
param webImage string

@secure()
@description('Administrator password for PostgreSQL')
param postgresAdminPassword string

@description('Entra ID tenant id (ReqPOOL tenant)')
param entraTenantId string = ''

@description('Entra ID app registration (client) id')
param entraClientId string = ''

@description('Auto-login bypass user; set to empty string to disable in production')
param autoLoginUser string = 'florian@bingro.com'

@description('GHCR/registry server for image pulls, empty for public images')
param registryServer string = ''
param registryUsername string = ''
@secure()
param registryPassword string = ''

var prefix = 'bgem'
// Postgres server and Key Vault names must be globally unique. The server
// name also depends on its region so a region move never collides with a
// failed-provisioning tombstone of the old name.
var suffix = uniqueString(resourceGroup().id)
var pgServerName = '${prefix}-pg-${uniqueString(resourceGroup().id, postgresLocation)}'
var dbName = 'estimation_manager'

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${prefix}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${prefix}kv${suffix}'
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: tenant().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
  }
}

resource dbPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'postgres-admin-password'
  properties: { value: postgresAdminPassword }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: pgServerName
  location: postgresLocation
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: 'emadmin'
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: 32 }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
  }
}

resource pgDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgres
  name: dbName
}

// Allow Azure services (Container Apps outbound) to reach the server.
resource pgFirewall 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

var registryConfig = empty(registryServer) ? [] : [
  {
    server: registryServer
    username: registryUsername
    passwordSecretRef: 'registry-password'
  }
]

var registrySecrets = empty(registryServer) ? [] : [
  { name: 'registry-password', value: registryPassword }
]

resource apiApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-api'
  location: location
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      ingress: {
        external: false
        targetPort: 8000
        transport: 'http'
        // nginx in the web app proxies via plain http on the internal network.
        allowInsecure: true
      }
      registries: registryConfig
      secrets: concat(registrySecrets, [
        {
          name: 'database-url'
          value: 'postgresql+psycopg://emadmin:${postgresAdminPassword}@${postgres.properties.fullyQualifiedDomainName}:5432/${dbName}?sslmode=require'
        }
      ])
    }
    template: {
      containers: [
        {
          name: 'api'
          image: apiImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'ENTRA_TENANT_ID', value: entraTenantId }
            { name: 'ENTRA_CLIENT_ID', value: entraClientId }
            { name: 'AUTO_LOGIN_USER', value: autoLoginUser }
            { name: 'CORS_ORIGINS', value: 'https://${prefix}-web.${containerEnv.properties.defaultDomain}' }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
}

resource webApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-web'
  location: location
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'http'
      }
      registries: registryConfig
      secrets: registrySecrets
    }
    template: {
      containers: [
        {
          name: 'web'
          image: webImage
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            // Internal FQDN of the API app inside the environment.
            { name: 'API_UPSTREAM', value: 'http://${apiApp.name}' }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
}

output webUrl string = 'https://${webApp.properties.configuration.ingress.fqdn}'
output postgresFqdn string = postgres.properties.fullyQualifiedDomainName
output keyVaultName string = keyVault.name
