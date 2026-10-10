#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { PlatformStack } from '../lib/platform-stack'

const app = new cdk.App()

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  // São Paulo by default — this is a Brazilian restaurant app. Override
  // with `-c awsRegion=us-east-1` (or any other region) if you'd rather
  // deploy elsewhere.
  region: (app.node.tryGetContext('awsRegion') as string) ?? process.env.CDK_DEFAULT_REGION ?? 'sa-east-1',
}

const repoUrl =
  (app.node.tryGetContext('repoUrl') as string) ?? 'https://github.com/marcioasm84/restauranteApp.git'
const blueprintId = app.node.tryGetContext('blueprintId') as string | undefined
const bundleId = app.node.tryGetContext('bundleId') as string | undefined
const sshAllowedCidr = app.node.tryGetContext('sshAllowedCidr') as string | undefined

// Fase do guia AWS_DEPLOYMENT.md: "pilot" (padrão — 1 GB, HTTP, sem backup
// S3) ou "prod" (2 GB, Caddy/HTTPS, backup S3). Escolha com `-c phase=prod`.
const phase = (app.node.tryGetContext('phase') as string | undefined) ?? 'pilot'
if (phase !== 'pilot' && phase !== 'prod') {
  throw new Error(`phase inválida: "${phase}" (use pilot ou prod)`)
}

new PlatformStack(app, 'MeuRestaurante-Platform', { env, phase, repoUrl, blueprintId, bundleId, sshAllowedCidr })
