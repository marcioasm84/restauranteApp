import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lightsail from 'aws-cdk-lib/aws-lightsail'
import * as s3 from 'aws-cdk-lib/aws-s3'
import type { Construct } from 'constructs'

/**
 * "pilot" = Fase 1 (AWS_DEPLOYMENT.md): só a instância, porta 80, pacote de
 * 1 GB, sem bucket/usuário de backup. "prod" = Fase 2: portas 80+443, pacote
 * de 2 GB, bucket S3 + usuário IAM de backup.
 */
export type Phase = 'pilot' | 'prod'

export interface PlatformStackProps extends StackProps {
  /** Fase do guia de implantação; define os padrões de pacote, portas e backup. */
  phase: Phase
  /** Git URL this instance clones/pulls on boot and on every deploy. */
  repoUrl: string
  /**
   * Lightsail blueprint (OS image) id — confirme o valor atual com
   * `aws lightsail get-blueprints --query "blueprints[?platform=='LINUX_UNIX']"`
   * antes de implantar; nomes de blueprint mudam entre gerações.
   */
  blueprintId?: string
  /**
   * Lightsail bundle (tamanho) id — confirme o valor atual com
   * `aws lightsail get-bundles --query "bundles[?ramSizeInGb==\`2\`]"` antes
   * de implantar; o sufixo de geração (ex. `_3_0`) muda com o tempo. Padrão:
   * `micro_3_0` (1 GB) na fase pilot, `small_3_0` (2 GB) na fase prod.
   */
  bundleId?: string
  /** Your own IP (CIDR, e.g. "203.0.113.4/32"). Omit to leave SSH closed and connect via o console web do Lightsail. */
  sshAllowedCidr?: string
}

// Tudo o que a plataforma precisa, numa única instância Lightsail: o
// docker-compose.yml do próprio app (postgres, redis, backend, frontend)
// mais Caddy na frente para HTTPS automático — ver AWS_DEPLOYMENT.md para o
// raciocínio completo. Esta stack substitui uma versão anterior baseada em
// EC2 (VPC própria, Security Group, IAM Instance Role, Elastic IP, Route 53
// com desafio DNS via Route 53). A troca para Lightsail + Cloudflare existe
// porque: (1) o pacote do Lightsail já embute computação + disco + IP
// estático + franquia de tráfego por um preço fixo, sem a cobrança de IPv4
// público que a EC2 passou a ter; (2) Lightsail não tem equivalente a IAM
// Instance Role, então a autenticação do desafio DNS do Caddy sai do Route
// 53 (que dependia da role) para o Cloudflare (token de API escopado só a
// DNS, nunca toca outros recursos AWS) — ver parecer técnico na sessão que
// motivou esta mudança.
export class PlatformStack extends Stack {
  constructor(scope: Construct, id: string, props: PlatformStackProps) {
    super(scope, id, props)

    const blueprintId = props.blueprintId ?? 'amazon_linux_2023'
    const isProd = props.phase === 'prod'
    const bundleId = props.bundleId ?? (isProd ? 'small_3_0' : 'micro_3_0')

    // Backup S3 + usuário IAM só existem na Fase 2 (produção). No piloto o
    // backup é apenas o snapshot diário do Lightsail (add-on abaixo), então
    // nenhuma credencial AWS precisa existir na instância.
    let backupUserName: string | undefined
    if (isProd) {
      // Backups do Postgres (pg_dump diário, ver infra/scripts/backup-postgres.sh)
      // — expira sozinho depois de 30 dias, então o custo de armazenamento
      // nunca cresce sem controle.
      const backupBucket = new s3.Bucket(this, 'BackupBucket', {
        removalPolicy: RemovalPolicy.RETAIN,
        lifecycleRules: [{ expiration: Duration.days(30) }],
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      })

      // Lightsail não tem IAM Instance Role — a instância não "é" nada na
      // IAM, então o único jeito de ela falar com um serviço AWS (aqui, só
      // o S3 do backup) é uma credencial de longa duração. Por isso este
      // usuário tem a permissão mais estreita possível: só gravar objetos
      // neste bucket específico, nada além disso. A access key em si NÃO é
      // criada por este stack (ver AWS_DEPLOYMENT.md) — gerar a chave via
      // CDK a deixaria registrada nos outputs/histórico do CloudFormation;
      // em vez disso, é um passo manual de CLI (`aws iam create-access-key`).
      const backupUser = new iam.User(this, 'BackupUser', {
        userName: 'meu-restaurante-backup',
      })
      backupBucket.grantWrite(backupUser)
      backupUserName = backupUser.userName

      new CfnOutput(this, 'BackupBucketName', { value: backupBucket.bucketName })
      new CfnOutput(this, 'BackupUserName', { value: backupUser.userName })
    }

    // Só prepara a máquina (Docker, clone inicial) — o primeiro deploy de
    // verdade (colocar o .env com os segredos e subir os containers) é um
    // passo manual documentado em AWS_DEPLOYMENT.md.
    const userData = [
      'dnf update -y',
      'dnf install -y docker git',
      'systemctl enable --now docker',
      // Plugin v2 (`docker compose`, como usado em deploy.sh) — bundles
      // Lightsail são x86_64.
      'mkdir -p /usr/local/lib/docker/cli-plugins',
      'curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose',
      'chmod +x /usr/local/lib/docker/cli-plugins/docker-compose',
      // Rede de segurança barata pro pico de memória do build do frontend
      // (vite/esbuild), que roda junto com os containers antigos ainda de
      // pé — ver AWS_DEPLOYMENT.md seção de dimensionamento.
      'fallocate -l 2G /swapfile',
      'chmod 600 /swapfile',
      'mkswap /swapfile',
      'swapon /swapfile',
      'echo "/swapfile none swap sw 0 0" >> /etc/fstab',
      'mkdir -p /opt/app',
      `git clone ${props.repoUrl} /opt/app || true`,
    ].join('\n')

    const instanceName = 'meu-restaurante-platform'

    const instance = new lightsail.CfnInstance(this, 'Instance', {
      instanceName,
      availabilityZone: `${this.region}a`,
      blueprintId,
      bundleId,
      userData,
      networking: {
        ports: [
          { fromPort: 80, toPort: 80, protocol: 'tcp', accessFrom: 'Anywhere (0.0.0.0/0)', cidrs: ['0.0.0.0/0'] },
          // 443 só faz sentido com o Caddy da Fase 2; o piloto é HTTP puro.
          ...(isProd
            ? [{ fromPort: 443, toPort: 443, protocol: 'tcp', accessFrom: 'Anywhere (0.0.0.0/0)', cidrs: ['0.0.0.0/0'] }]
            : []),
          // SSH (22): o alias "lightsail-connect" libera só o cliente SSH do
          // navegador do console Lightsail (aba "Connect") — sem ele o
          // console diz "Browser-based SSH connections aren't available".
          // `sshAllowedCidr` (opcional) acrescenta o seu IP para SSH normal.
          {
            fromPort: 22,
            toPort: 22,
            protocol: 'tcp',
            accessFrom: 'Custom',
            cidrListAliases: ['lightsail-connect'],
            ...(props.sshAllowedCidr ? { cidrs: [props.sshAllowedCidr] } : {}),
          },
        ],
      },
      // Snapshot diário nativo do Lightsail — substitui a política de DLM
      // que a versão em EC2 precisava declarar à parte.
      addOns: [
        {
          addOnType: 'AutoSnapshot',
          status: 'Enabled',
          autoSnapshotAddOnRequest: { snapshotTimeOfDay: '05:00' },
        },
      ],
    })

    const staticIp = new lightsail.CfnStaticIp(this, 'StaticIp', {
      staticIpName: `${instanceName}-ip`,
      attachedTo: instance.instanceName,
    })
    staticIp.addDependency(instance)

    new CfnOutput(this, 'InstancePublicIp', { value: staticIp.attrIpAddress })
    new CfnOutput(this, 'NextSteps', {
      value: isProd
        ? 'Falta: 1) criar a zona no Cloudflare e apontar os registros A (apex e *) pro IP acima; ' +
          '2) gerar o token de API do Cloudflare (permissão Zone:DNS:Edit, só nessa zona); ' +
          '3) rodar aws iam create-access-key --user-name ' +
          backupUserName +
          ' e guardar a chave; 4) ver AWS_DEPLOYMENT.md (Fase 2) para o resto.'
        : 'Piloto: 1) no console do Lightsail (Connect) crie /opt/app/.env com DEPLOY_MODE=pilot e ' +
          'PLATFORM_URL=http://<IP-com-hifens>.sslip.io; 2) rode sudo bash /opt/app/infra/scripts/deploy.sh; ' +
          '3) acesse http://<IP-com-hifens>.sslip.io/super-admin. Ver AWS_DEPLOYMENT.md (Fase 1).',
    })
  }
}
