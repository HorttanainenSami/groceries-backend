## Alustus

### Testaus
Luo .env.test tiedosto jossa on seuraavat kohdat
```
DATABASE_PORT=5434
DATABASE_USER=sami
DATABASE_HOST=localhost
DATABASE_PASSWORD=secret
DATABASE_NAME=groceries
SECRET=SECRET

POSTGRES_PASSWORD=secret
POSTGRES_USER=sami
POSTGRES_DB=groceries

DATABASE_URL=postgresql://sami:secret@localhost:5434/groceries

```


Luo psql serveri seuraavien tietojen perusteella
1. Pidä huoli että Docker on käynnissä
2. Käynnistä docker image
```
npm run test-sql
```
3. Alusta tietokanta testi datalla ja käynnistä testi serveri
```
npm run test-server
```

