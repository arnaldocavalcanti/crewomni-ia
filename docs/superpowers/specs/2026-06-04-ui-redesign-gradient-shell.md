# UI Redesign — Gradient Shell

**Data:** 2026-06-04
**Status:** Aprovado
**Escopo:** Redesign completo do sistema visual — layout, cores, tipografia, componentes, login e onboarding

---

## 1. Objetivo

Substituir o layout atual (escuro, sem identidade, Geist Sans) por um sistema visual profissional, intuitivo e acessível para qualquer nível de usuário — derivado diretamente da identidade do logo crewomni.ia.

**Princípios:**
- Claro por padrão (dark mode opcional via toggle)
- Sidebar lateral fixa (drawer no mobile)
- Personalidade tech vibrante — contraste alto, gradientes nos CTAs, sensação de produto de ponta
- Responsivo: web desktop + mobile

---

## 2. Paleta de Cores

| Token CSS | Valor | Uso |
|---|---|---|
| `--color-cyan` | `#06C8E8` | Início do gradiente, destaques |
| `--color-blue` | `#4F6EF7` | Meio do gradiente, links ativos, focus |
| `--color-purple` | `#7C3AED` | Fim do gradiente, badges, accents |
| `--color-navy` | `#0F0E2A` | Texto principal |
| `--background` | `#F5F7FF` | Fundo da área de conteúdo |
| `--sidebar-bg` | `#FFFFFF` | Fundo da sidebar |
| `--card-bg` | `#FFFFFF` | Fundo de cards |
| `--border` | `#E8ECF4` | Bordas de cards e inputs |
| `--text-muted` | `#6B7280` | Texto secundário |
| `--text-primary` | `#0F0E2A` | Texto principal |

**Gradiente primário** (CTAs, itens ativos, barras de progresso):
```css
linear-gradient(135deg, #06C8E8 0%, #4F6EF7 50%, #7C3AED 100%)
```

**Badges de status:**
| Status | Fundo | Texto |
|---|---|---|
| ATIVO | `#ECFDF5` | `#059669` |
| INATIVO | `#F3F4F6` | `#6B7280` |
| RASCUNHO | `#FFF7ED` | `#D97706` |
| ERRO | `#FEF2F2` | `#DC2626` |

---

## 3. Tipografia

**Fonte principal:** Inter (substituir Geist Sans)
**Fonte mono:** Geist Mono (manter para IDs e código)

| Uso | Peso | Tamanho |
|---|---|---|
| Título de página (H1) | 700 | 24px |
| Subtítulo / card header | 600 | 16px |
| Body padrão | 400 | 14px |
| Labels / badges | 500 | 12px |
| Mono (IDs, código) | 400 | 13px |

---

## 4. Layout Geral

### Desktop

```
┌──────────────────────────────────────────────────────────────┐
│ SIDEBAR (240px fixo)     │ MAIN CONTENT                      │
│ bg: white                │ bg: #F5F7FF                       │
│ border-right: #E8ECF4    │                                   │
│                          │ TOP BAR (60px)                    │
│ Logo (64px height)       │  Título + breadcrumb + CTA + User │
│                          │                                   │
│ Nav items                │ CONTENT AREA (padding: 24px)      │
│                          │  Cards, tabelas, formulários      │
│ ─────────────────────    │                                   │
│ Avatar + Nome            │                                   │
│ Configurações            │                                   │
│ Sair                     │                                   │
└──────────────────────────────────────────────────────────────┘
```

### Mobile (< 768px)
- Sidebar vira drawer deslizante (abre via hamburger no top bar)
- Top bar sticky com título centralizado e hamburger à esquerda
- Cards empilham em coluna única
- Bottom navigation bar com 4 ícones principais (opcional fase 2)

---

## 5. Sidebar — Comportamento dos Nav Items

| Estado | Fundo | Texto | Ícone | Borda esquerda |
|---|---|---|---|---|
| Inativo | transparente | `#6B7280` | `#9CA3AF` | nenhuma |
| Hover | `#F0F4FF` | `#4F6EF7` | `#4F6EF7` | nenhuma |
| Ativo | gradiente 10% opacity | `#0F0E2A` bold | gradiente | `3px` gradiente sólido |

Nav items ativos têm `border-radius: 8px` e a barra lateral de 3px com o gradiente primário.

---

## 6. Componentes

### Cards
- `bg: white`
- `border: 1px solid #E8ECF4`
- `border-radius: 12px`
- `box-shadow: 0 1px 4px rgba(15, 14, 42, 0.06)`
- **Hover:** border-color muda para gradiente (via `outline` ou `box-shadow` colorido) + sombra elevada

### Botões
| Tipo | Estilo |
|---|---|
| Primário | Gradiente ciano→roxo, texto branco, `border-radius: 8px`, `padding: 10px 20px` |
| Secundário | `border: 1px solid #E8ECF4`, bg white, texto navy |
| Ghost | Sem borda, texto `#4F6EF7` no hover |
| Destrutivo | `#EF4444`, apenas onde necessário |

### Inputs / Forms
- Border `#E8ECF4` em repouso
- Focus: `border-color: #4F6EF7` + `box-shadow: 0 0 0 3px rgba(79,110,247,0.12)`
- Label: Inter 500, 12px, `text-transform: uppercase`, `letter-spacing: 0.05em`
- Placeholder: `#9CA3AF`

### Empty States
```
        [Ícone grande 48px]
   Título descritivo (16px, 600)
   Explicação curta do que fazer (14px, muted)
        [CTA primário]
```
Sempre com ícone, texto explicativo e botão de ação direta.

### Toasts / Notificações
- Posição: canto inferior direito
- Ícone colorido por tipo
- Auto-dismiss: 4 segundos
- Tipos: sucesso (verde), erro (vermelho), aviso (amarelo), info (azul)

---

## 7. Página de Login

**Layout split — desktop:**
```
┌──────────────────────────┬──────────────────────────┐
│ Painel Esquerdo          │ Formulário               │
│ bg: gradiente 5% opacity │ bg: white                │
│ sobre #F5F7FF            │                          │
│                          │ [Logo crewomni.ia]       │
│ [Logo grande]            │                          │
│                          │ "Bem-vindo de volta"     │
│ "Orquestre equipes de IA │ "Entre na sua conta"     │
│  com inteligência."      │                          │
│                          │ [Email]                  │
│ • Crews ilimitados       │ [Senha]                  │
│ • Agentes especializados │                          │
│ • Colaboração real       │ [Entrar] ← gradiente     │
│                          │                          │
│                          │ Não tem conta?           │
│                          │ [Criar conta grátis]     │
└──────────────────────────┴──────────────────────────┘
```

**Mobile:** Painel esquerdo desaparece. Formulário centralizado com logo no topo.

---

## 8. Onboarding (Wizard — primeira vez)

Exibido apenas na primeira sessão após criação de conta. Ignorável via "Pular por agora".

**Passo 1:** Nome da organização
```
"Como sua empresa se chama?"
[Input: Ex: Acme Corp]
[Continuar →]
```

**Passo 2:** Criar primeiro Crew
```
"Um Crew é uma equipe de agentes com um objetivo."
[Nome do Crew]  [Objetivo]
[Criar Crew →]
```

**Passo 3:** Conclusão
```
🎉 Seu Crew está criado.
[Abrir meu Crew →]
```

- Barra de progresso no topo com gradiente primário
- 3 passos máximo, sem formulários longos
- Redirecionamento automático ao dashboard ao concluir

---

## 9. Dark Mode (opcional)

Ativado via toggle no rodapé da sidebar. Persiste via `localStorage`.

| Token | Light | Dark |
|---|---|---|
| `--background` | `#F5F7FF` | `#0D0C1A` |
| `--sidebar-bg` | `#FFFFFF` | `#13111F` |
| `--card-bg` | `#FFFFFF` | `#1A1830` |
| `--border` | `#E8ECF4` | `#2D2B45` |
| `--text-primary` | `#0F0E2A` | `#F0EFFF` |
| `--text-muted` | `#6B7280` | `#8B8AA0` |

O gradiente primário permanece idêntico em ambos os modos.

---

## 10. Arquivos a Criar / Modificar

| Arquivo | Ação |
|---|---|
| `src/app/globals.css` | Substituir tokens de cor e adicionar Inter |
| `src/app/layout.tsx` | Trocar fonte Geist → Inter, remover `dark` por padrão |
| `src/app/(dashboard)/dashboard/layout.tsx` | Redesign completo da sidebar |
| `src/app/(auth)/login/page.tsx` | Redesign completo com split layout |
| `src/components/ui/` | Atualizar button, card, badge, input com novos tokens |
| `src/components/ui/empty-state.tsx` | Criar componente de empty state |
| `src/components/ui/theme-toggle.tsx` | Criar toggle claro/escuro |
| `src/components/onboarding/` | Criar wizard de onboarding |
| `src/app/globals.css` (tokens adicionais) | Projeto usa Tailwind v4 — cores via CSS custom properties, sem tailwind.config |

---

## 11. Fora do Escopo

- Mudanças na lógica de negócio ou APIs
- Novos fluxos de funcionalidade
- Alterações em testes existentes (apenas atualizar seletores de UI se necessário)
