# Ostoslista backend

Projekti osana Fullstack open kurssin ohjelmisto projektia.
Backend on deployatty VPS serverille.

Backend ostoslista mobiilisovellukselle.

## Motivaatio

Vaimon kanssa ostoslistojen säätäminen turhautti kun välillä ostoslista tulee joko:

- viestinä
- paperillisena
- paperillisena ja viestinä perästä lisäyksistä
- Whatsapissa ostokset ripoteltuna viestien sekaan
- Whatsapissa kuva paperillisesta ostoslistasta
- Whatsapissa kuva paperillisesta ostoslistasta + viestinä lisäyksiä

Tämän johdosta kotona tuli useammin kuin muutaman kerran "Ainiin se unohtu" -tilanteita.

Päätin luoda projektina ostoslistan jota voidaan käyttää lokaalisti ja jakaa tarpeentullen toisen käyttäjän kanssa.
Myös reaaliaikainen muokkaaminen tuli projektin aikana tarpeelliseksi. Mielenkiinnosta halusin toteuttaa myös offline first sync toiminnallisuuden.

## Projektiin käytetty aika

| Käytetty aika |                                                                                                                      |
| :------------ | -------------------------------------------------------------------------------------------------------------------: |
| 92 h          |      [Frontendin työaikakirjaus](https://github.com/HorttanainenSami/groceries-frontend/blob/master/aikataulutus.md) |
| 94.5 h        | [Backendin työaikakirjaus](https://github.com/HorttanainenSami/groceries-backend/blob/master/ty%C3%B6tuntikuvaus.md) |
| 187 h         |                                                                                                             Yhteensä |

## Esivaatimukset

- Node.js (v20+)
- Docker & Docker Compose
- npm

## Stack

- Nodejs
- Socket.io
- JWT token
- postgres
- Typescript
- Zod
- Express

## Toiminnallisuudet

- Pysyväistallennus (Postgres)
- Jaettavat ostoslistat reaaliaikaisella päivityksellä (Socket.io)
- Käyttäjän autentikointi (JWT tokenilla)
- Salasanojen suojaus (bcrypt)
- Tietokannan migraatiot (node-pg-migrate)
- Käyttäjän syötteen validointi (Zod)
- Lokaali ensin synkronoinnin konfliktien hallinta
- TypeScript
- Jaetut tyypit frontendin kanssa [@groceries/shared_types](https://github.com/HorttanainenSami/groceries-shared-types)

## Synkronointi

<img src="images/sync-work-flow.png" alt="Alt Text" width="400" height="600">

## Konfliktien hallinta

Käyttäjä tekee muutoksia tuote_1:seen käyttäjä_2:n kanssa jaettuun ostoslistaan.
Käyttäjä on offline tilassa joten muutokset tallentuu vain käyttäjän laitteeseen.

<img src="images/user_makes_changes_offline.png" alt="Alt Text" width="400" height="250">

Tämän jälkeen Käyttäjä_2 tekee muutoksia myös tuote_1:seen. Käyttäjä_2 on verkossa joten serveri päivittyy

<img src="images/colloborator_makes_changes_to_server.png" alt="Alt Text" width="400" height="600">

Käyttäjä pääsee taas verkkoon, joten muutokset synkronoituu serverille. Aiheutuu konflikti.

<img src="images/user_syncs_to_backend_LLW_conflict.png" alt="Alt Text" width="400" height="700">

Serveri käyttää LLW periaatetta konfliktien hallintaan. Eli konfliktitilanteessa viimeiseksi muokattu (last_modified) voittaa.
Yllä mainitussa tilanteessa Käyttäjän muutos perutaan ja serveri palauttaa pilveen tallennetun uudemman tuotteen käyttäjälle joka korvaa laitteella olevan tuotteen.

## Konfliktien reunatapaukset

Listassa rajatapaukset mitkä tuottavat onnistuneen tilanteen kun muokattava kohde on poistettu

|         | Lista poistettu | Tuote poistettu |
| :------ | :-------------: | :-------------: |
| Create  |                 |                 |
| Edit    |                 |                 |
| Delete  |                 |       ✅        |
| Toggle  |                 |                 |
| Reorder |                 |                 |

### Alustus

### Konfiguraatiot

---

1. Luo `.env.dev` ja `.env.test` tiedosto. Käytä pohjana `env.example` tiedostoa

```.env.dev
DATABASE_PORT=5433
DATABASE_USER=DEV_USER
DATABASE_HOST=localhost
DATABASE_PASSWORD=SALASANA
DATABASE_NAME=groceries
SECRET=SALAISUUS

POSTGRES_USER=DEV_USER
POSTGRES_PASSWORD=SALASANA
POSTGRES_DB=groceries

DATABASE_URL=postgres://DEV_USER:SALASANA@localhost:5433/groceries

```

---

1. lataa riippuvuudet projektille `npm i`

2. Käynnistä docker

3. Alusta Docker image tietokannalle `npm run dev-sql`

4. Alusta tietokannan migraatiot `npm run migrate:up`
5. `npm run dev` avaa projektin dev ympäristössä

### Testaus

Luo .env.test tiedosto jossa on seuraavat kohdat

```.env.test
DATABASE_PORT=5434
DATABASE_USER=TEST
DATABASE_HOST=localhost
DATABASE_PASSWORD=SALASANA
DATABASE_NAME=groceries_test
SECRET=SALAISUUS

POSTGRES_USER=TEST
POSTGRES_PASSWORD=SALASANA
POSTGRES_DB=groceries_test

DATABASE_URL=postgres://TEST:SALASANA@localhost:5434/groceries_test

```

## Backendin integraatio ja yksikkötestit

1. Pidä huoli että Docker on käynnissä
2. Käynnistä testitietokanta Dockerissa `npm run test-sql` -komennolla
3. Suorita testit `npm run test`

## Linkkejä

- [Työtuntikuvaus](työtuntikuvaus.md)
- [Frontend](https://github.com/HorttanainenSami/groceries-frontend)
- [@groceries/shared_types](https://github.com/HorttanainenSami/groceries-shared-types)
