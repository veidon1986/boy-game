# 🚀 Деплой «Игры для детей» на VDS + свой домен

Приложение чисто статическое (HTML/CSS/JS, без бэкенда и сборки). Нужен любой
веб-сервер, отдающий файлы, и **HTTPS** — без него service worker и установка на
телефон (`PWA`) не работают.

Ниже — вариант на **Ubuntu/Debian + nginx + Let's Encrypt**. Замените:

- `YOUR_DOMAIN` — ваш домен (например `games.example.com`)
- `YOUR_SERVER_IP` — IP вашего VDS

---

## 0. Что понадобится (чеклист)

- [ ] VDS с Ubuntu/Debian и доступом по SSH (root или sudo).
- [ ] Зарегистрированный домен.
- [ ] Доступ к DNS-панели домена (добавить A-запись).
- [ ] `rsync`/`scp` на компьютере (на macOS уже есть).
- [ ] Открытые порты **80** и **443** на сервере (и в панели хостера, если есть их фаервол).

---

## 1. Домен и DNS

В DNS-панели домена добавьте:

| Тип | Имя | Значение            |
|-----|-----|---------------------|
| A   | @   | YOUR_SERVER_IP      |
| A   | www | YOUR_SERVER_IP      |

Проверьте, что запись уже разошлась (обычно 1–15 минут):

```bash
dig +short YOUR_DOMAIN
```

Должен вернуться IP вашего VDS.

---

## 2. Подготовка сервера

Подключитесь и обновите систему:

```bash
ssh root@YOUR_SERVER_IP
apt update && apt upgrade -y
```

Фаервол (не отключайте SSH!):

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

(Если фаервол настраивается в панели хостера — откройте 80 и 443 там.)

---

## 3. Установка nginx

```bash
apt install -y nginx
systemctl enable --now nginx
```

Откройте `http://YOUR_SERVER_IP` — увидите заглушку nginx. Значит, всё работает.

---

## 4. Загрузка файлов

С вашего компьютера (macOS) выполните из папки проекта:

```bash
ssh root@YOUR_SERVER_IP "mkdir -p /var/www/boygame"
rsync -avz --delete \
  --exclude '.git' \
  --exclude 'tools' \
  --exclude 'deploy' \
  --exclude 'DEPLOY.md' \
  ./ root@YOUR_SERVER_IP:/var/www/boygame/
```

Права на файлы:

```bash
ssh root@YOUR_SERVER_IP "chown -R www-data:www-data /var/www/boygame && find /var/www/boygame -type d -exec chmod 755 {} \; && find /var/www/boygame -type f -exec chmod 644 {} \;"
```

---

## 5. Конфиг сайта в nginx

Скопируйте на сервер файл `deploy/nginx-boygame.conf` (например, через тот же
`rsync` или `scp`), замените `YOUR_DOMAIN` и положите его в
`/etc/nginx/sites-available/boygame`:

```bash
scp deploy/nginx-boygame.conf root@YOUR_SERVER_IP:/etc/nginx/sites-available/boygame
ssh root@YOUR_SERVER_IP "ln -sf /etc/nginx/sites-available/boygame /etc/nginx/sites-enabled/boygame && nginx -t && systemctl reload nginx"
```

Отключите дефолтный сайт-заглушку, чтобы он не перехватывал запросы:

```bash
ssh root@YOUR_SERVER_IP "rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx"
```

Проверьте:

```bash
curl -I http://YOUR_DOMAIN
curl -I http://YOUR_DOMAIN/manifest.webmanifest   # Content-Type: application/manifest+json
```

---

## 6. HTTPS (Let's Encrypt) — обязательно для PWA

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d YOUR_DOMAIN -d www.YOUR_DOMAIN
```

Certbot сам: получит сертификат, добавит HTTPS-блок и редирект с HTTP на HTTPS,
настроит авто-продление. Проверить продление:

```bash
certbot renew --dry-run
```

Готово — сайт доступен по `https://YOUR_DOMAIN`.

---

## 7. Проверка PWA

Откройте `https://YOUR_DOMAIN` и в DevTools (F12) → **Application**:

- **Manifest**: без ошибок, есть иконки.
- **Service Workers**: `sw.js` — статус `activated`.
- **Cache Storage**: есть кэш `boygame-vNN`.

На телефоне: откройте сайт и выберите «Добавить на главный экран». После
установки приложение открывается без адресной строки и работает офлайн.

---

## 8. Как обновлять приложение

После правок снова залейте файлы (шаг 4). Service worker отдаёт обновление при
следующем открытии; мы специально меняем номер кэша в `sw.js` (`boygame-vNN`),
поэтому пользователи получают свежую версию. Файлы `sw.js` и `index.html` в
конфиге отдаются без кэша, чтобы обновление не «залипало».

---

## Через GitHub (без Mac при обновлениях)

Если код лежит на GitHub, можно деплоить прямо из репозитория — ваш компьютер
для этого не нужен.

### Один раз: залить проект на GitHub

```bash
cd ~/Desktop/BoyGame
git init
git add .
git commit -m "Игры для детей: первая версия"
git branch -M main
git remote add origin git@github.com:USERNAME/boygame.git
git push -u origin main
```

### Вариант A — авто-выгрузка на VDS через GitHub Actions (рекомендую)

Файл workflow уже готов: `.github/workflows/deploy.yml`. Он при каждом `git push`
в `main` заливает файлы в `/var/www/boygame` на вашем сервере.

Один раз настройте ключ и секреты:

```bash
# 1. Создайте отдельный ключ для деплоя (без пароля) на своём Mac
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/boygame_deploy -N ""

# 2. Положите публичную часть на сервер
ssh-copy-id -i ~/.ssh/boygame_deploy.pub root@YOUR_SERVER_IP

# 3. Скопируйте ПРИВАТНЫЙ ключ — он понадобится как секрет (шаг ниже)
cat ~/.ssh/boygame_deploy
```

В GitHub: **Settings → Secrets and variables → Actions → New repository secret**,
добавьте три секрета:

| Имя секрета   | Значение                          |
|---------------|-----------------------------------|
| `SERVER_HOST` | IP или домен VDS                  |
| `SERVER_USER` | пользователь SSH (обычно `root`)  |
| `SSH_KEY`     | содержимое `~/.ssh/boygame_deploy`|

После этого любой `git push` сам обновит сайт (следить можно во вкладке
**Actions**). Перед этим сервер, nginx и HTTPS настраиваются как в шагах 2–6.

> Если выбрали GitHub Pages — файл `.github/workflows/deploy.yml` можно удалить,
> он нужен только для деплоя на собственный сервер.

### Вариант B — просто клонировать репозиторий на сервере

Без Actions, но обновление делается одной командой по SSH:

```bash
# на сервере (один раз)
apt install -y git
git clone https://github.com/USERNAME/boygame.git /var/www/boygame

# обновление после push
cd /var/www/boygame && git pull
```

Для приватного репозитория используйте deploy-ключ или токен.

### Вариант C — GitHub Pages (совсем без VDS)

Приложение статическое, поэтому GitHub может раздавать его сам, с бесплатным
HTTPS — PWA при этом работает. **VDS тогда не нужен вообще**, но репозиторий для
бесплатных Pages должен быть **публичным** (или нужен GitHub Pro).

1. Залейте проект на GitHub (как выше).
2. **Settings → Pages → Source: Deploy from a branch → main / (root)**.
3. Через минуту сайт доступен на `https://USERNAME.github.io/boygame/`.
4. Свой домен: там же **Custom domain** → введите `YOUR_DOMAIN` (создастся файл
   `CNAME`). В DNS: для `www` — `CNAME` на `USERNAME.github.io`; для корня — `A`
   на IP GitHub Pages (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
   `185.199.111.153`). Затем включите **Enforce HTTPS**.

Файл `.nojekyll` я уже добавил в проект — он нужен, чтобы GitHub Pages отдавал
статические файлы как есть.

## Альтернатива: Caddy (автоматический HTTPS одной командой)

Если не хочется возиться с certbot — поставьте **Caddy**, он сам получает и
продлевает сертификаты. Конфиг в `deploy/Caddyfile`:

```bash
apt install -y caddy
cp deploy/Caddyfile /etc/caddy/Caddyfile   # заменить YOUR_DOMAIN
systemctl reload caddy
```

---

## Мелочи и безопасность

- Добавьте SSH-ключ и отключите вход по паролю (`/etc/ssh/sshd_config`:
  `PasswordAuthentication no`), если ещё не сделали.
- Не подключайте домен через сторонний прокси без необходимости; если используете
  Cloudflare — включите режим **Full (strict)**, иначе возможны проблемы с HTTPS.
- Прогресс игр хранится только в браузере ребёнка (localStorage) и никуда не
  отправляется — на сервере никакой базы данных не нужно.
