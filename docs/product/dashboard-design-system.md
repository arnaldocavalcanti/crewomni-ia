# CrewOmni Dashboard — Design System & Screen Specs

> Documento de referência para implementação do Dashboard básico (Fase 1).
> Stack: Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui + lucide-react + Geist font.

---

## 1. Design Tokens & Paleta

### 1.1 CSS Variables (globals.css — dark mode nativo)

```css
:root {
  /* Backgrounds */
  --background:        #0a0a0b;   /* page bg */
  --surface:           #111113;   /* cards, panels */
  --surface-hover:     #1a1a1f;   /* hover state */
  --border:            #222228;   /* borders */
  --border-strong:     #333340;   /* dividers destacados */

  /* Texto */
  --text-primary:      #f2f2f5;   /* títulos, valores */
  --text-secondary:    #8b8b9e;   /* labels, subtítulos */
  --text-muted:        #55555f;   /* placeholders, info */

  /* Marca */
  --accent:            #6366f1;   /* indigo-500 — primário */
  --accent-hover:      #4f46e5;   /* indigo-600 */
  --accent-subtle:     #1e1b4b;   /* bg de badges accent */

  /* Status badges */
  --status-active:     #16a34a;   /* green-600 */
  --status-active-bg:  #052e16;   /* green-950 */
  --status-draft:      #52525b;   /* zinc-600 */
  --status-draft-bg:   #18181b;   /* zinc-900 */
  --status-archived:   #dc2626;   /* red-600 */
  --status-archived-bg:#450a0a;   /* red-950 */
  --status-open:       #2563eb;   /* blue-600 */
  --status-open-bg:    #172554;   /* blue-950 */
  --status-closed:     #52525b;   /* zinc-600 */
  --status-closed-bg:  #18181b;   /* zinc-900 */

  /* Sidebar */
  --sidebar-bg:        #0d0d10;
  --sidebar-item:      #8b8b9e;
  --sidebar-active:    #f2f2f5;
  --sidebar-active-bg: #1e1e28;

  /* Destructive */
  --destructive:       #dc2626;
  --destructive-bg:    #450a0a;
}
```

### 1.2 Tailwind Aliases (tailwind.config)

```js
// Mapeamento direto das variáveis acima em Tailwind 4 via @theme
// Em globals.css, após os :root vars:
// @theme { --color-accent: var(--accent); ... }
```

### 1.3 Status Badge Classes

| Status     | Tailwind classes                                                        |
|------------|-------------------------------------------------------------------------|
| ACTIVE     | `bg-green-950 text-green-400 border border-green-800`                  |
| DRAFT      | `bg-zinc-900 text-zinc-400 border border-zinc-700`                     |
| ARCHIVED   | `bg-red-950 text-red-400 border border-red-800`                        |
| OPEN       | `bg-blue-950 text-blue-400 border border-blue-800`                     |
| CLOSED     | `bg-zinc-900 text-zinc-400 border border-zinc-700`                     |

---

## 2. Tipografia

Base: `font-family: 'Geist', sans-serif` (já configurada)

| Elemento         | Classes Tailwind                              |
|------------------|-----------------------------------------------|
| Page title (h1)  | `text-2xl font-semibold tracking-tight`       |
| Section title    | `text-lg font-medium`                         |
| Card label       | `text-xs font-medium uppercase tracking-wide text-zinc-400` |
| Card value       | `text-3xl font-bold tabular-nums`             |
| Table header     | `text-xs font-medium text-zinc-500 uppercase tracking-wide` |
| Table cell       | `text-sm text-zinc-200`                       |
| Body text        | `text-sm text-zinc-300`                       |
| Muted / caption  | `text-xs text-zinc-500`                       |
| Button primary   | `text-sm font-medium`                         |
| Input label      | `text-sm font-medium text-zinc-300`           |

---

## 3. Layout Global

### 3.1 Estrutura de Shell

```
┌─────────────────────────────────────────────────┐
│  Sidebar (240px fixed)  │  Main Content Area      │
│                         │  ┌─────────────────┐    │
│  [Logo]                 │  │ Page Header      │    │
│                         │  │ title + actions  │    │
│  Nav links:             │  ├─────────────────┤    │
│  • Dashboard            │  │                 │    │
│  • Agents               │  │  Content        │    │
│  • Conversations        │  │                 │    │
│  • Settings (future)    │  │                 │    │
│                         │  └─────────────────┘    │
│  ─────────────────       │                         │
│  [Avatar] Tenant name   │                         │
│  [Logout]               │                         │
└─────────────────────────────────────────────────┘
```

### 3.2 Sidebar — Classes

```tsx
// Container
<aside className="w-60 min-h-screen bg-[#0d0d10] border-r border-zinc-800/50 flex flex-col fixed left-0 top-0 bottom-0 z-40">

  // Logo area
  <div className="h-14 flex items-center px-4 border-b border-zinc-800/50">
    <span className="text-base font-semibold text-white tracking-tight">CrewOmni</span>
  </div>

  // Nav
  <nav className="flex-1 px-2 py-4 space-y-0.5">
    // Item inativo
    <a className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors">
    // Item ativo
    <a className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white bg-zinc-800/80 font-medium">
  </nav>

  // Footer
  <div className="p-4 border-t border-zinc-800/50">
    <p className="text-xs text-zinc-500 truncate">tenant-name</p>
    <button className="text-xs text-zinc-400 hover:text-red-400 transition-colors mt-1">Sair</button>
  </div>
</aside>
```

### 3.3 Main Content

```tsx
<main className="ml-60 min-h-screen bg-[#0a0a0b]">
  <div className="max-w-7xl mx-auto px-6 py-8">
    {/* Page header */}
    <div className="flex items-center justify-between mb-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Page Title</h1>
      <Button>Action</Button>
    </div>
    {/* Content */}
  </div>
</main>
```

---

## 4. Tela 1 — Login

### Layout

```
┌─────────────────────────────────────────────────┐
│               (full screen centered)             │
│                                                  │
│          ┌─────────────────────────┐             │
│          │  CrewOmni logo          │             │
│          │  "Acesse sua conta"     │             │
│          │                         │             │
│          │  [Email input]          │             │
│          │  [Senha input]          │             │
│          │  [Entrar — full width]  │             │
│          │                         │             │
│          │  {error message}        │             │
│          └─────────────────────────┘             │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Componentes shadcn/ui

- `Card`, `CardHeader`, `CardContent`, `CardFooter`
- `Input` (type email, type password)
- `Label`
- `Button` (variant default, fullWidth)
- Alert destrutivo para erros

### Classes principais

```tsx
// Page wrapper
<div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center px-4">

// Card
<Card className="w-full max-w-sm bg-zinc-900 border-zinc-800">
  <CardHeader className="space-y-1 pb-4">
    <h1 className="text-xl font-semibold text-zinc-100">CrewOmni</h1>
    <p className="text-sm text-zinc-400">Acesse sua conta</p>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-zinc-300">E-mail</Label>
      <Input type="email" placeholder="voce@empresa.com"
             className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-indigo-500" />
    </div>
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-zinc-300">Senha</Label>
      <Input type="password"
             className="bg-zinc-800 border-zinc-700 text-zinc-100 focus-visible:ring-indigo-500" />
    </div>
    {error && (
      <p className="text-xs text-red-400 bg-red-950 border border-red-800 rounded-md px-3 py-2">{error}</p>
    )}
  </CardContent>
  <CardFooter>
    <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium">
      Entrar
    </Button>
  </CardFooter>
</Card>
```

### Estados

- **Loading:** `<Button disabled>` com `<Loader2 className="mr-2 h-4 w-4 animate-spin" />`
- **Error:** painel vermelho acima do botão com mensagem da API

---

## 5. Tela 2 — Dashboard Home

### Layout

```
┌────────────────────────────────────────────────┐
│ Sidebar │  Dashboard Home                       │
│         │  ─────────────────────────────────── │
│         │  ┌──────────┐ ┌──────────┐           │
│         │  │ Agentes  │ │Conversas │            │
│         │  │ Ativos   │ │ (hoje)   │            │
│         │  │    12    │ │    47    │            │
│         │  └──────────┘ └──────────┘            │
│         │                                       │
│         │  Atividade Recente                    │
│         │  ┌────────────────────────────────┐  │
│         │  │ [agente] [tipo] [status] [data]│  │
│         │  │ ...                             │  │
│         │  └────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

### Componentes

- `Card`, `CardHeader`, `CardTitle`, `CardContent`
- `Badge` (status)
- Tabela nativa (não shadcn Table) ou `Table`, `TableBody`, `TableRow`, `TableCell`
- `Skeleton` para loading state

### Metric Cards

```tsx
// Grid de métricas
<div className="grid grid-cols-2 gap-4 mb-8">
  <Card className="bg-zinc-900 border-zinc-800">
    <CardContent className="pt-6">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Agentes Ativos</p>
      <p className="text-3xl font-bold text-zinc-100 mt-1 tabular-nums">12</p>
      <p className="text-xs text-zinc-500 mt-1">de 15 criados</p>
    </CardContent>
  </Card>
  <Card className="bg-zinc-900 border-zinc-800">
    <CardContent className="pt-6">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Conversas Hoje</p>
      <p className="text-3xl font-bold text-zinc-100 mt-1 tabular-nums">47</p>
      <p className="text-xs text-zinc-500 mt-1">+12% vs ontem</p>
    </CardContent>
  </Card>
</div>
```

### Estados

- **Loading:** `<Skeleton className="h-20 w-full rounded-lg bg-zinc-800" />`
- **Empty:** ícone `Bot` da lucide + "Nenhum agente criado ainda." + botão "Criar primeiro agente"

---

## 6. Tela 3 — Lista de Agentes

### Layout

```
┌────────────────────────────────────────────────┐
│ Sidebar │  Agentes                [+ Novo Agente]│
│         │  ─────────────────────────────────── │
│         │  Nome      | Tipo    | Status | Data  │
│         │  ──────────────────────────────────  │
│         │  SDR Vendas│ SDR     │ ACTIVE │ 01/06 │
│         │  HelpDesk  │HELPDESK │ DRAFT  │ 28/05 │
│         │  Prospecção│ SDR     │ARCHIVED│ 20/05 │
└────────────────────────────────────────────────┘
```

### Componentes

- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
- `Badge` (status colorido)
- `Button` (+ Novo Agente)
- `DropdownMenu` com ações: Ver, Arquivar
- `Skeleton` para loading

### Classes

```tsx
// Table wrapper
<div className="rounded-lg border border-zinc-800 overflow-hidden">
  <Table>
    <TableHeader>
      <TableRow className="border-zinc-800 hover:bg-transparent">
        <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wide bg-zinc-900/50">Nome</TableHead>
        <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wide bg-zinc-900/50">Tipo</TableHead>
        <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wide bg-zinc-900/50">Status</TableHead>
        <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wide bg-zinc-900/50">Criado em</TableHead>
        <TableHead className="bg-zinc-900/50 w-10" />
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow className="border-zinc-800 hover:bg-zinc-800/40 cursor-pointer">
        <TableCell className="text-sm font-medium text-zinc-100">SDR Vendas</TableCell>
        <TableCell className="text-sm text-zinc-400">SDR</TableCell>
        <TableCell>
          <Badge className="bg-green-950 text-green-400 border-green-800">ACTIVE</Badge>
        </TableCell>
        <TableCell className="text-sm text-zinc-500">01/06/2026</TableCell>
        <TableCell>
          <DropdownMenu>...</DropdownMenu>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</div>
```

### Estados

- **Loading:** 5 linhas de `<Skeleton className="h-12 w-full bg-zinc-800/50" />`
- **Empty state:**
  ```tsx
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <Bot className="h-12 w-12 text-zinc-700 mb-4" />
    <p className="text-sm font-medium text-zinc-300">Nenhum agente criado</p>
    <p className="text-xs text-zinc-500 mb-4">Crie seu primeiro agente de IA</p>
    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500">+ Novo Agente</Button>
  </div>
  ```

---

## 7. Tela 4 — Detalhe do Agente

### Layout

```
┌───────────────────────────────────────────────────────┐
│ Sidebar │  ← Agentes  |  SDR Vendas  [ACTIVE] [Editar]│
│         │  ─────────────────────────────────────────  │
│         │  ┌────────────────────┐ ┌─────────────────┐ │
│         │  │ Informações        │ │  Chat de Teste  │ │
│         │  │ Tipo: SDR          │ │                 │ │
│         │  │ Status: ACTIVE     │ │  [histórico]    │ │
│         │  │ Criado: 01/06      │ │                 │ │
│         │  ├────────────────────┤ │  [input + send] │ │
│         │  │ System Prompt      │ └─────────────────┘ │
│         │  │ (textarea readonly)│                     │
│         │  └────────────────────┘                     │
└───────────────────────────────────────────────────────┘
```

### Componentes

- `Badge` (status)
- `Card`, `CardHeader`, `CardTitle`, `CardContent`
- `Textarea` (readonly para prompt ativo)
- `Separator`
- `Button` (Editar Prompt, Arquivar)
- Chat: `ScrollArea`, `Input`, `Button` com ícone Send
- `Tabs` para alternar Info / Prompt / Chat

### Classes principais

```tsx
// Layout duas colunas
<div className="grid grid-cols-[1fr_380px] gap-6">
  // Coluna esquerda — detalhes
  <div className="space-y-6">
    // Header do card
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium text-zinc-100">{agent.name}</CardTitle>
          <Badge className="bg-green-950 text-green-400 border-green-800">ACTIVE</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Tipo</span>
          <span className="text-zinc-200 font-medium">SDR</span>
        </div>
        <Separator className="bg-zinc-800" />
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Criado em</span>
          <span className="text-zinc-200">01/06/2026</span>
        </div>
      </CardContent>
    </Card>

    // System Prompt card
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Prompt Ativo</CardTitle>
        <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
          Editar Prompt
        </Button>
      </CardHeader>
      <CardContent>
        <Textarea readOnly value={agent.systemPrompt}
                  className="min-h-48 bg-zinc-800/50 border-zinc-700 text-zinc-300 text-xs font-mono resize-none" />
      </CardContent>
    </Card>
  </div>

  // Coluna direita — Chat de teste
  <Card className="bg-zinc-900 border-zinc-800 flex flex-col h-[calc(100vh-180px)]">
    <CardHeader className="pb-3 border-b border-zinc-800">
      <CardTitle className="text-sm font-medium text-zinc-300">Chat de Teste</CardTitle>
    </CardHeader>
    <ScrollArea className="flex-1 p-4">
      // mensagens
    </ScrollArea>
    <div className="p-3 border-t border-zinc-800 flex gap-2">
      <Input placeholder="Enviar mensagem..."
             className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500" />
      <Button size="icon" className="bg-indigo-600 hover:bg-indigo-500">
        <Send className="h-4 w-4" />
      </Button>
    </div>
  </Card>
</div>
```

### Mensagens do Chat

```tsx
// Mensagem do usuário
<div className="flex justify-end mb-3">
  <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-indigo-600 px-3.5 py-2.5 text-sm text-white">
    {message.content}
  </div>
</div>

// Mensagem do agente
<div className="flex gap-2 mb-3">
  <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
    <Bot className="h-3.5 w-3.5 text-zinc-400" />
  </div>
  <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-zinc-800 border border-zinc-700 px-3.5 py-2.5 text-sm text-zinc-200">
    {message.content}
  </div>
</div>
```

---

## 8. Tela 5 — Criar Agente

### Layout

```
┌────────────────────────────────────────────────┐
│ Sidebar │  ← Agentes  |  Criar Agente           │
│         │  ─────────────────────────────────── │
│         │  ┌──────────────────────────────┐    │
│         │  │ Nome do Agente               │    │
│         │  │ [_________________________]  │    │
│         │  │                              │    │
│         │  │ Tipo                         │    │
│         │  │ [Select ▼]                   │    │
│         │  │                              │    │
│         │  │ Descrição                    │    │
│         │  │ [_________________________]  │    │
│         │  │                              │    │
│         │  │ System Prompt                │    │
│         │  │ [textarea grande]            │    │
│         │  │                              │    │
│         │  │         [Cancelar] [Criar]   │    │
│         │  └──────────────────────────────┘    │
└────────────────────────────────────────────────┘
```

### Componentes

- `Card`, `CardContent`
- `Label`, `Input`, `Textarea`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
- `Button` (Cancelar = outline, Criar = primary)
- Validação inline com mensagem de erro

### Classes

```tsx
<div className="max-w-2xl">
  <Card className="bg-zinc-900 border-zinc-800">
    <CardContent className="pt-6 space-y-6">
      // Field group pattern:
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-zinc-300">Nome do Agente</Label>
        <Input placeholder="ex: SDR Devolus"
               className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-indigo-500" />
        {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-zinc-300">Tipo</Label>
        <Select>
          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
            <SelectValue placeholder="Selecionar tipo" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="SDR">SDR — Prospecção</SelectItem>
            <SelectItem value="HELPDESK">Helpdesk — Suporte</SelectItem>
            <SelectItem value="SUPPORT">Support — Atendimento</SelectItem>
            <SelectItem value="SALES">Sales — Comercial</SelectItem>
            <SelectItem value="NEGOTIATION">Negotiation — Negociação</SelectItem>
            <SelectItem value="ONBOARDING">Onboarding — Onboarding</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-zinc-300">Descrição</Label>
        <Input placeholder="Breve descrição da função do agente"
               className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-indigo-500" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-zinc-300">System Prompt</Label>
        <p className="text-xs text-zinc-500">Define o comportamento base do agente.</p>
        <Textarea placeholder="Você é um agente de SDR especializado em..."
                  className="min-h-64 bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 font-mono text-sm focus-visible:ring-indigo-500 resize-none" />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
          Cancelar
        </Button>
        <Button className="bg-indigo-600 hover:bg-indigo-500 text-white">
          Criar Agente
        </Button>
      </div>
    </CardContent>
  </Card>
</div>
```

### Estados

- **Submitting:** botão "Criar Agente" com `disabled` + spinner
- **Validation error:** `<p className="text-xs text-red-400">Campo obrigatório</p>` abaixo do campo
- **Success:** redirect para `/agents/:id`

---

## 9. Tela 6 — Lista de Conversas

### Layout

```
┌────────────────────────────────────────────────┐
│ Sidebar │  Conversas                            │
│         │  ─────────────────────────────────── │
│         │  [Filter: agente ▼] [status ▼]        │
│         │                                       │
│         │  Agente    |Msgs| Status | Data        │
│         │  ─────────────────────────────────── │
│         │  SDR Vendas│ 12 │ OPEN   │ 01/06 14h  │
│         │  HelpDesk  │  3 │ CLOSED │ 01/06 09h  │
└────────────────────────────────────────────────┘
```

### Componentes

- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
- `Badge` (status OPEN / CLOSED)
- `Select` (filtros: agente, status)
- Link para detalhe ao clicar na linha

### Classes

```tsx
// Filtros
<div className="flex gap-3 mb-4">
  <Select>
    <SelectTrigger className="w-44 bg-zinc-900 border-zinc-800 text-zinc-300 text-sm">
      <SelectValue placeholder="Todos os agentes" />
    </SelectTrigger>
    ...
  </Select>
  <Select>
    <SelectTrigger className="w-36 bg-zinc-900 border-zinc-800 text-zinc-300 text-sm">
      <SelectValue placeholder="Status" />
    </SelectTrigger>
    ...
  </Select>
</div>

// Table — mesmo padrão da tela de Agentes
// Badge OPEN: bg-blue-950 text-blue-400 border-blue-800
// Badge CLOSED: bg-zinc-900 text-zinc-400 border-zinc-700
```

### Estados

- **Loading:** 5 linhas de Skeleton
- **Empty:** `MessageSquare` icon + "Nenhuma conversa registrada"

---

## 10. Tela 7 — Detalhe da Conversa

### Layout

```
┌────────────────────────────────────────────────┐
│ Sidebar │  ← Conversas | Conv #abc123  [OPEN]   │
│         │  Agente: SDR Vendas · 12 mensagens    │
│         │  ─────────────────────────────────── │
│         │  ┌──────────────────────────────────┐ │
│         │  │                                  │ │
│         │  │  [user] Olá, preciso de ajuda    │ │
│         │  │  [agent] Claro, como posso...    │ │
│         │  │  [user] Quero saber sobre...     │ │
│         │  │  [agent] Ótimo, vou explicar...  │ │
│         │  │                                  │ │
│         │  └──────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

### Componentes

- `ScrollArea` (altura fixa, histórico scrollável)
- `Badge` (status conversa)
- `Separator`
- `Button` (Fechar Conversa, se OPEN)
- Sem input — conversa é auditoria (read-only)

### Classes

```tsx
// Header da conversa
<div className="flex items-center justify-between mb-6">
  <div>
    <div className="flex items-center gap-2 mb-1">
      <h1 className="text-lg font-semibold text-zinc-100">Conversa #{id.slice(0,8)}</h1>
      <Badge className="bg-blue-950 text-blue-400 border-blue-800">OPEN</Badge>
    </div>
    <p className="text-sm text-zinc-500">
      <span className="text-zinc-400">{agentName}</span> · {messageCount} mensagens · Iniciada em {date}
    </p>
  </div>
  {status === 'OPEN' && (
    <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-800">
      Fechar Conversa
    </Button>
  )}
</div>

// Timeline de mensagens
<Card className="bg-zinc-900 border-zinc-800">
  <ScrollArea className="h-[calc(100vh-260px)] p-6">
    <div className="space-y-4">
      {messages.map(msg => (
        msg.role === 'USER'
          ? <div className="flex justify-end">
              <div className="max-w-[70%] bg-indigo-600 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white">
                {msg.content}
                <p className="text-xs text-indigo-300 mt-1 text-right">{formatTime(msg.createdAt)}</p>
              </div>
            </div>
          : <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-zinc-400" />
              </div>
              <div className="max-w-[70%] bg-zinc-800 border border-zinc-700 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-zinc-200">
                {msg.content}
                <p className="text-xs text-zinc-500 mt-1">{formatTime(msg.createdAt)}</p>
              </div>
            </div>
      ))}
    </div>
  </ScrollArea>
</Card>
```

---

## 11. Componentes shadcn/ui — Lista completa necessária

```bash
# Instalar via CLI shadcn
npx shadcn@latest add badge button card input label select separator skeleton table textarea scroll-area dropdown-menu tabs
```

| Componente     | Telas onde é usado                          |
|----------------|---------------------------------------------|
| Badge          | Todas (status coloridos)                    |
| Button         | Todas                                       |
| Card           | Login, Home, Agente Detalhe, Criar, Chat    |
| Input          | Login, Criar Agente, Chat input             |
| Label          | Login, Criar Agente                         |
| Select         | Criar Agente, filtros de lista              |
| Separator      | Agente Detalhe                              |
| Skeleton       | Listas (loading state)                      |
| Table          | Lista Agentes, Lista Conversas              |
| Textarea       | Criar Agente, Agente Detalhe (prompt)       |
| ScrollArea     | Chat de teste, Detalhe da Conversa          |
| DropdownMenu   | Ações na tabela de Agentes                  |
| Tabs           | Agente Detalhe (Info / Prompt / Chat)       |

---

## 12. Rotas Next.js (App Router)

```
src/app/
├── (auth)/
│   └── login/
│       └── page.tsx
└── (dashboard)/
    ├── layout.tsx          ← Shell com Sidebar
    ├── page.tsx            ← Dashboard Home (redirect para /agents)
    ├── agents/
    │   ├── page.tsx        ← Lista de Agentes
    │   ├── new/
    │   │   └── page.tsx    ← Criar Agente
    │   └── [id]/
    │       └── page.tsx    ← Detalhe do Agente
    └── conversations/
        ├── page.tsx        ← Lista de Conversas
        └── [id]/
            └── page.tsx    ← Detalhe da Conversa
```

---

## 13. Espaçamentos padrão

| Contexto                    | Classes Tailwind             |
|-----------------------------|------------------------------|
| Page padding                | `px-6 py-8`                  |
| Section gap                 | `mb-8`                       |
| Card padding                | `p-6` (CardContent `pt-6`)   |
| Form field gap              | `space-y-6` entre fields     |
| Field label→input           | `space-y-1.5`                |
| Table cell padding          | `px-4 py-3` (padrão shadcn)  |
| Sidebar nav item            | `px-3 py-2`                  |
| Button group gap            | `gap-3`                      |
| Metric grid gap             | `gap-4`                      |
| Chat message gap            | `mb-3` entre mensagens       |
| Chat bubble padding         | `px-3.5 py-2.5`              |

---

## 14. Decisões de design (rationale)

1. **Dark mode only** — sem toggle light/dark no MVP. Público-alvo corporativo, padrão SaaS moderno.
2. **Sidebar fixa 240px** — navegação sempre visível, evita hamburger no desktop.
3. **Indigo como cor primária** — `indigo-600` (#4f46e5) — profissional, moderno, distingue-se do zinc da UI.
4. **Zinc como escala de cinza** — uniformidade com shadcn defaults; evita conflito com status colors.
5. **Badge com border** — melhor contraste no dark sem depender só de background.
6. **Chat de teste no detalhe do agente** — permite validar comportamento sem sair da configuração.
7. **Conversa detalhe read-only** — propósito de auditoria, não de chat ao vivo.
8. **max-w-2xl no formulário** — impede que o form se estique demais em telas largas.
9. **font-mono no textarea de prompt** — prompts são código; monoespaçado ajuda leitura.
10. **tabular-nums nos números** — evita salto visual ao atualizar contadores.
