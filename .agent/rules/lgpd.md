# LGPD e Privacidade — AI Agent Hub

## Princípios

- **Minimização**: coletar apenas o necessário para cada finalidade
- **Finalidade**: cada dado coletado tem finalidade declarada na spec
- **Transparência**: usuário final sabe o que é coletado e por quê
- **Segurança**: dados pessoais em repouso e em trânsito sempre criptografados
- **Não repúdio**: toda ação sobre dados pessoais é auditada

## Dados considerados pessoais neste projeto

- Nome, e-mail, telefone, CPF, CNPJ
- Endereço (qualquer granularidade)
- IP, device fingerprint, session ID vinculado a pessoa
- Conteúdo de conversas que identifique o usuário final
- Histórico de interações vinculado a pessoa identificável

## Regras de coleta e uso

| Dado | Finalidade | Retenção padrão |
|---|---|---|
| E-mail do usuário | Autenticação e comunicação | Até exclusão da conta |
| Mensagens do chat | Resposta ao cliente e auditoria | Configurável por tenant (padrão: 90 dias) |
| Logs de acesso | Segurança e auditoria | 1 ano |
| Embeddings de conversas | RAG — memória contextual | Mesma retenção das mensagens |

## Knowledge Distillation Layer (KDL) — regras LGPD

- Dados brutos de conversas NUNCA saem do escopo do tenant
- A KDL processa em memória — não persiste dados brutos intermediários
- `AnonymizeCandidate` deve remover: nomes, CPF, CNPJ, endereços, valores específicos, referências a empresas e pessoas
- Aprovadores humanos visualizam apenas conhecimento genérico — nunca dados brutos
- Todo candidato aprovado deve ter score de anonimização registrado no audit log

## Direitos dos titulares

Cada tenant deve poder acionar via API interna:

| Direito | Use-case |
|---|---|
| Acesso | `ExportTenantData` |
| Retificação | Via dashboard do tenant |
| Exclusão | `DeleteTenantData` — apaga banco relacional + vetores + cache |
| Portabilidade | `ExportConversations` (JSON/CSV) |
| Revogação de consentimento | `RevokeConsent` — anonimiza mensagens futuras |

## Consentimento

- Widget de chat deve exibir aceite explícito antes do início da conversa
- Texto do aceite é configurável por tenant
- Consentimento registrado com timestamp, IP e versão do texto aceito

## DPO por tenant

```typescript
TenantSettings {
  dpoName: string
  dpoEmail: string
  privacyPolicyUrl: string
  dataRetentionDays: number  // padrão: 90
}
```

## O que fazer ao encontrar dado pessoal fora do escopo correto

1. Não propague o dado
2. Registre no audit log como `PRIVACY_VIOLATION_CANDIDATE`
3. Acione alerta para o administrador da plataforma
4. Nunca corrija silenciosamente sem auditoria

## Checklist antes de implementar qualquer feature que toque em dados pessoais

- [ ] Spec tem seção 12 (Critérios LGPD) preenchida?
- [ ] Finalidade declarada?
- [ ] Retenção definida?
- [ ] Exclusão implementada ou planejada?
- [ ] Audit log cobre todas as operações de leitura e escrita?
- [ ] KDL garante anonimização antes de qualquer saída do tenant?
