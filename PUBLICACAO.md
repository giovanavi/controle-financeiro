# Publicação do app (Cloudflare + Supabase)

Os nomes de botões e menus das duas plataformas podem mudar um pouco com o tempo. Se algo não estiver igual, procure o equivalente.

## A. No seu computador

1. Instale as duas ferramentas novas:
   ```
   npm install -D vite-plugin-pwa wrangler
   ```
2. Extraia o zip na raiz do projeto (ao lado do `package.json`), aceitando substituir `vite.config.js`, `index.html` e `src/main.jsx`.
3. Abra o arquivo `.gitignore` e acrescente esta linha no fim:
   ```
   .wrangler
   ```
4. Confira se o app "compila":
   ```
   npm run build
   ```
   Deve terminar sem erros e criar a pasta `dist`. (Avisos sobre arquivos grandes são normais.)
5. Salve no Git:
   ```
   git add .
   git commit -m "Publicação e app instalável"
   git push
   ```

## B. Cloudflare (conta gratuita)

1. Crie a conta em dash.cloudflare.com.
2. No menu, entre em **Workers & Pages** e escolha criar um aplicativo a partir de um repositório (**Import a repository**). Conecte o GitHub, autorize e escolha o repositório do projeto.
3. **Nome do projeto:** `controle-financeiro`. Precisa ser igual ao `name` do arquivo `wrangler.jsonc`, senão a publicação falha.
4. **Comandos:**
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
5. **Variáveis de build** (Build variables and secrets), com os mesmos valores do seu `.env.local`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

   Importante: as variáveis do Vite entram no app na hora da compilação, então precisam ser variáveis de **build**. Se você as incluir depois, é preciso disparar uma nova publicação.
   Nunca coloque aqui a chave `secret` ou `service_role`.
6. Salve e publique (**Save and Deploy**). Ao terminar, a Cloudflare mostra o endereço, algo como `https://controle-financeiro.SEU-SUBDOMINIO.workers.dev`.

## C. Supabase

1. Em **Authentication**, abra **URL Configuration**.
2. Em **Site URL**, coloque o endereço publicado. Em **Redirect URLs**, acrescente o mesmo endereço.

## D. Teste e instalação no celular

1. Abra o endereço no celular e entre com o seu e-mail e senha.
2. **Android (Chrome):** menu de três pontos, depois **Instalar app** ou **Adicionar à tela inicial**.
3. **iPhone (Safari):** botão de compartilhar, depois **Adicionar à Tela de Início**.

## E. Como atualizar depois

1. Mude o código, rode `git add .`, `git commit -m "..."` e `git push`.
2. A Cloudflare publica a nova versão sozinha, em poucos minutos.
3. No app instalado, aparece **Nova versão disponível**; toque em **Atualizar**.
4. Se a mudança precisar de SQL, rode o SQL no Supabase **antes** de enviar o código.

## Se algo der errado

- **Login falha com "verifique sua conexão":** a URL de build está errada. Corrija a variável e publique de novo.
- **Página em branco:** as variáveis de build não foram definidas antes da publicação. Defina e publique de novo.
- **Erro ao recarregar uma tela interna:** confira se o `wrangler.jsonc` foi enviado ao GitHub.
- **A publicação falha logo no início:** confira se o nome do projeto é igual ao `name` do `wrangler.jsonc`.
