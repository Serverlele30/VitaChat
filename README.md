# VitaChat API auf Vercel

Serverless-Backend (Node.js) + Neon Postgres. Ersetzt das alte PHP/SQLite-Setup.
Das Protokoll ist unverändert — der Vita-Client braucht nur eine neue URL.

## Einrichtung (~10 Minuten)

### 1. Projekt anlegen
Diesen Ordner in ein GitHub-Repo pushen, dann auf vercel.com "Add New Project"
und das Repo importieren. Framework: "Other" (wird meist automatisch erkannt).

Alternativ ohne GitHub:
    npm i -g vercel
    vercel        # im Projektordner, folgt dem Assistenten

### 2. Datenbank verbinden
Im Vercel-Dashboard: Projekt -> Storage -> Create Database -> Neon (Postgres).
Vercel legt die Variable DATABASE_URL automatisch an. Danach EINMAL neu
deployen, damit die Variable in den Funktionen ankommt (Deployments -> Redeploy).

### 3. Tabellen anlegen
Einmal im Browser aufrufen:
    https://<projekt>.vercel.app/api/setup
Erwartet: OK|Datenbank bereit

### 4. Testen
    curl -d "user=test&pass=1234" https://<projekt>.vercel.app/api/register
    curl -d "user=test&pass=1234" https://<projekt>.vercel.app/api/login

Web-Client: https://<projekt>.vercel.app/

### 5. Vita-Client anpassen
In client/src/net.h die Basis-URL ersetzen:

    #define API_BASE "https://<projekt>.vercel.app/api"

Dann neu bauen:
    cd ~/vitachat/client/build && make

## Struktur
    api/setup.js      Tabellen anlegen (einmalig)
    api/register.js   POST user, pass
    api/login.js      POST user, pass          -> OK|<token>
    api/send.js       POST token, to, text     -> OK|<msg_id>
    api/poll.js       GET  token, with, since  -> MSG|id|from|ts|text
    api/contacts.js   GET  token               -> USER|name|online|unread|last_ts|preview
    lib/db.js         DB-Verbindung, Passwort-Hashing (scrypt), Protokoll-Helfer
    public/index.html Web-Client (wird unter / ausgeliefert)

## Hinweise
- Passwörter: scrypt aus Nodes crypto-Modul, keine Extra-Abhängigkeit.
- Fehler kommen als "ERR|<text>" mit HTTP 200, damit der Vita-Client die
  Zeile in jedem Fall lesen kann.
- Neon-Freetier schläft nach Inaktivität ein; der erste Aufruf danach
  dauert ~1 s. Durch das Polling der App bleibt sie im Betrieb wach.
- Logs bei Problemen: Vercel-Dashboard -> Projekt -> Logs.
