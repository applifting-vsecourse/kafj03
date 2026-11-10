# Odpovědi na quacky se zachováním diskuse po smazání

Stav: implementace dle odsouhlaseného návrhu; ověření je uvedeno na konci dokumentu. Větev: `feat/quack-replies-story`.

Tato story nahrazuje předchozí pravidla fyzického mazání quacků. Zachovává oprávnění autora a administrátora i potvrzování akce; zavádí odstranění obsahu a autorství se zachováním struktury diskuse.

## Story

Jako přihlášený uživatel chci odpovědět na quack i konkrétní odpověď a vidět diskusi pod původním quackem, abych věděl, kdo na co reaguje.

Jako autor chci nevratně odstranit svůj obsah a jeho spojení se mnou, aniž tím smažu cizí odpovědi. Stejné pravidlo platí při zásahu administrátora a smazání účtu.

## Akceptační kritéria

### Zobrazení a navigace

1. Odpověď je plnohodnotný `Quack` s vlastním autorem, textem, volitelnou náladou a anketou. Reagovat lze na kořen i libovolnou odpověď, včetně vlastní nebo smazané.
2. Diskuse má samostatný detail: původní quack nahoře, plochý seznam všech odpovědí pod ním. Žádné vnořování. Každá odpověď má stabilní přímý odkaz.
3. Hlavní feed bez hledání zobrazuje pouze kořeny. Hledání a „Moje“ zahrnují i odpovědi s odkazem do diskuse. Hledání v „Moje“ omezuje výsledky na vlastní příspěvky. Smazané položky nejsou výsledkem hledání ani součástí „Moje“.
4. Tlačítko „Odpovědi (počet)“ otevře diskusi. Počet zahrnuje všechny nesmazané odpovědi v diskusi bez ohledu na hloubku a počítá se z řádků, bez uloženého čítače.
5. Smazaný kořen zůstává ve feedu na původním místě, pokud existuje alespoň jedna nesmazaná odpověď v celé diskusi. Po smazání poslední živé odpovědi se skryje; nová odpověď jej znovu zpřístupní. Řazení feedu zůstává podle vytvoření kořene.
6. Odpověď ukazuje aktuálního autora adresáta, prvních 100 znaků jeho textu a odkaz. Náhled vzniká čtením rodiče, nikoli uloženou citací. Po smazání adresáta zůstane jen anonymní označení „Odpověď na smazaný quack“ a odkaz.
7. Odpovědi jsou od nejstarší, stabilně podle `(createdAt, id)`, po nejvýše 20 položkách. „Načíst další“ pokračuje za poslední načtenou položkou. Stránka zahrnuje i všechny smazané odpovědi jako zástupné položky; počítadlo diskuse zahrnuje jen živé.
8. Přímý odkaz i odkaz na adresáta otevře odpovídající část diskuse a zvýrazní cíl, včetně smazaného cíle, bez ručního procházení všech předchozích stránek. Z cílové části lze přejít na začátek diskuse nebo načíst další odpovědi.
9. Zcela smazaná diskuse není ve feedu, ale zůstává dostupná přímým odkazem a lze na ni odpovědět. Neexistující ID vrací 404. Zástupné řádky se automaticky neodstraňují.

### Psaní odpovědi

10. Jeden formulář pod diskusí standardně odpovídá na kořen. „Odpovědět“ u příspěvku nastaví adresáta a přesune fokus do formuláře. Náhled adresáta lze zrušit návratem ke kořeni. Změna adresáta zachová rozepsaný obsah.
11. Platí současné validace: neprázdný oříznutý text do 280 znaků, volitelná nálada s předvolbou z nastavení autora, volitelná anketa s neprázdnou otázkou do 280 znaků a 2–5 neprázdnými možnostmi do 100 znaků, jedinečnými bez ohledu na velikost písmen. Validuje i server. Obsah ani nálada rodiče se nekopírují.
12. Autor se bere ze session. Klient posílá obsah a volitelné `parentId`; `rootId` odvodí server z rodiče. Klient nesmí určovat autora, kořen ani stav smazání. Nový samostatný quack má obě vazby prázdné.
13. Během odesílání je další odeslání zablokované. Po úspěchu se formulář vyprázdní, obnoví předvolenou náladu a adresáta nastaví na kořen; nová odpověď se načte a zvýrazní. Při chybě zůstanou hodnoty zachované a lze pokus opakovat. Serverové koncepty nevznikají.
14. Smazání rodiče během psaní nebo odesílání nebrání vytvoření odpovědi, protože jeho řádek zůstává.

### Oprávnění a odstranění obsahu

15. Číst a odpovídat smí každý přihlášený uživatel. Mazat smí autor nebo aktuální `admin`; server ověřuje roli z databáze při požadavku, ne pouze ze session. Autor kořene nemá právo mazat cizí odpovědi.
16. Mazání je dostupné v seznamech i detailu. Potvrzení vysvětlí nevratné odstranění obsahu, ankety a hlasů a zachování cizích odpovědí. Zrušení nic nemění, probíhající akci nelze odeslat znovu, chyba umožní opakování.
17. Jedna transakce odstraní případný `Poll` a jeho možnosti/hlasy, nastaví `text`, `mood`, `userId` na `NULL` a vyplní `deletedAt`. Obnova obsahu není možná; identitu mazajícího a důvod nově neukládáme.
18. Zůstane anonymní zástupná položka bez autora, avataru, textu, nálady a ankety. Technická ID, vazby a časy zůstávají. Zástupná položka sama neukazuje náhled svého rodiče ani další akci smazání; nadále umožňuje odpovědět.
19. Cizí odpovědi, jejich autoři, ankety a hlasy zůstanou nedotčeny. Vazby se nepřepisují. Opakované smazání existující zástupné položky přes API vrátí 204 bez změny; neexistující ID vrací 404.
20. Při smazání účtu se ve stejné transakci nejprve vyčistí všechny jeho živé quacky a jejich ankety, odstraní jeho `PollVoterUsage` a pak uživatel. Přímý DELETE účtu s nevyčištěnými quacky databáze odmítne. Nové UI mazání účtu není součástí story.
21. `PollUsage` přežívá smazání quacku i účtu. `PollVoterUsage` přežívá smazání quacku, ale vlastní řádek zmizí s účtem; historický počet unikátních hlasujících se může snížit.

### Synchronizace a konzistence

22. Po commitu se smazání rozešle otevřeným přihlášeným klientům přes SSE. Událost obsahuje jen identifikátory a stav/čas, nikdy obsah či autora. Odběr funguje i bez zobrazené ankety.
23. Klient odstraní obsah ze všech cache, rodičovských náhledů, hledání, detailů, stránek a cache ankety. Zneplatní starší rozpracovaná načítání, aby opožděný výsledek neobnovil odstraněná data. Obnoví počty a viditelnost kořene. Otevřený detail zůstává ve stejné diskusi.
24. Výpadek synchronizace je viditelný. Při reconnectu nebo návratu do aplikace se před opětovným zobrazením neověřených dat ověří jejich aktuální stav. `NOTIFY` není trvalý replay log; reconnect vždy obnoví data. Již doručená data odpojeného zařízení nelze na dálku vymazat.
25. Souběh hlasování a smazání nesmí zachovat anketu nebo obnovit její cache. Souběh mazání účtu a vytvoření příspěvku nesmí vytvořit živý quack bez autora. Transakce buď dokončí celé mazání, nebo nezmění nic.
26. Databáze vynucuje správný kořen a rodiče, neměnnost vazeb, nevratnost smazání a nepřítomnost obsahu, autora i ankety u smazaného quacku. Vedle schématu jsou nutné SQL CHECK a triggery.

České názvy popisují význam; nové texty rozhraní budou podle dosavadní story anglicky, např. „Reply“, „Replies“, „This quack was deleted“, „Load more“. Zachová se ovládání klávesnicí, fokus a přístupné oznámení chyb a úspěchu. Návrat do feedu zachová filtr a hledání.

## Rozhodnutí

| Rozhodnutí          | Zvolená varianta a přínos                                     | Zamítnuté varianty a proč                                                                     | Nevýhoda / co se později obtížně mění                                                     |
| ------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Reakce i na odpověď | Přesný adresát, ploché UI.                                    | Jen kořen ztrácí adresáta; vnořený strom komplikuje čtení na mobilu a stránkování.            | Budoucí strom změní čtení, ale potřebné vazby existují.                                   |
| Smazané místo       | Anonymní zástupný quack zachová kontext.                      | Zachování autora ponechává identifikaci; fyzické mazání s přesunem reakcí mění jejich význam. | Obsah ani autorství nelze obnovit.                                                        |
| Model odpovědi      | Plnohodnotný `Quack`, sdílené funkce.                         | Textový Quack zavádí zvláštní omezení; samostatný `Reply` duplikuje logiku a vazby.           | Oddělení modelů později vyžaduje přesun dat a zachování odkazů.                           |
| Výpisy              | Odpovědi v hledání a „Moje“, hlavní feed jen kořeny.          | Jen v diskusi se špatně hledají; všechny ve feedu jej mohou zahltit.                          | Změna bez migrace, ale mění objevitelnost starých diskusí.                                |
| Smazaný kořen       | Ve feedu, dokud má živou odpověď.                             | Úplné skrytí ztěžuje přístup k cizí diskusi.                                                  | Nutný test existence živé odpovědi; bez zvláštního uloženého stavu.                       |
| Stránkování         | Od nejstaršího po 20.                                         | Nejnovější první obrací rozhovor; vše najednou neškáluje.                                     | Změna pořadí mění kurzory a navigaci.                                                     |
| Reakce na smazané   | Povoleny i na zástupné položky.                               | Zákaz všech nebo jen smazaných odpovědí omezuje pokračování a komplikuje souběh s psaním.     | Zástupná ID musí zůstat adresovatelná.                                                    |
| Vazby diskuse       | `parentId` + `rootId`, jednoduché výpisy a počty.             | Jen rodič vyžaduje rekurzi; samostatný `Thread` přidává tabulku bez současné potřeby.         | Odvozený kořen musí být konzistentní; přesun větve by vyžadoval změnu pravidel i potomků. |
| Smazání účtu        | Vyčistit obsah a autorství, zachovat strukturu.               | Pouhá anonymizace ponechá text; zákaz mazání účtu zhoršuje postup uživatele.                  | Řízená transakce místo Cascade, odstraněná data neobnovíme.                               |
| Stav smazání        | `deletedAt`, nullable text a autor; známe stav i čas.         | Boolean neuchová čas; `QuackContent` znamená větší migraci a další relace.                    | Čtení musí zvládnout NULL, samotná nullable pole nehlídají platný stav.                   |
| Detail diskuse      | Samostatná stránka, počet odvozený.                           | Rozbalení prodlužuje feed; tři náhledové odpovědi přidávají obsah a dotazy.                   | Nová routa a navigace; nevznikne nekonzistentní uložený čítač.                            |
| Upozornění          | První verze bez nich.                                         | Upozornění v aplikaci vyžaduje stav přečtení; e-mail navíc doručování a neodvolatelnou kopii. | Staré reakce nemají historii doručení/přečtení.                                           |
| Prázdná diskuse     | Zachovat všechny zástupné řádky.                              | Fyzický úklid zruší odkazy a vyžaduje koordinaci s novými reakcemi.                           | Zůstávají metadata; fyzicky odstraněné vazby nelze obnovit.                               |
| Náhled adresáta     | Aktuální autor, 100 znaků a odkaz přes rodiče.                | Jen autor a odkaz nabízejí méně kontextu.                                                     | Další JOIN, historickou podobu náhledu neuchováváme.                                      |
| Propagace mazání    | Událost po commitu, obnova po reconnectu.                     | Ruční načtení i interval 15 s ponechávají smazaný obsah déle viditelný.                       | SSE a konzistence cache; offline data nelze odvolat.                                      |
| Oprávnění           | Dosavadní autor/admin, všichni přihlášení čtou a odpovídají.  | Pravomoc autora kořene nad cizími odpověďmi nebyla přijata.                                   | Bez evidence důvodu/mazajícího tyto údaje zpětně nezískáme.                               |
| Historické metriky  | PollUsage zachovat, vlastní PollVoterUsage odstranit s účtem. | Uchování všeho nechává ID smazaného účtu; mazání PollUsage mění historii anket.               | Report unikátních hlasujících může klesnout.                                              |
| Formulář            | Jeden s volbou adresáta, bez serverových konceptů.            | Více formulářů a serverové koncepty nebyly požadovány a přidávají stav.                       | Rozepsaný obsah nepřežije reload.                                                         |
| Smazané odpovědi    | Všechny jako zástupné položky i ve stránkování.               | Jen položky s přímými reakcemi komplikují stabilní výpis a dohledání cíle.                    | Dlouhá smazaná diskuse může mít mnoho prázdných položek.                                  |
| Integrita           | Aplikace, FK, CHECK a triggery.                               | Pouhá aplikace neochrání přímé zápisy a skripty.                                              | Ruční SQL migrace, kontrola souběhu a koordinované změny pravidel.                        |

## Navržené schéma

Následující blok nahrazuje pouze model `Quack` v `apps/backend/prisma/schema.prisma`. Ostatní modely a enumy zůstávají beze změny, včetně `User.quacks`, `Poll.quack` a kaskád `Poll → PollOption → PollVote`. Blok zachycuje odsouhlasený návrh; schéma a SQL pravidla jsou implementována v migraci `20261110120000_quack_replies`.

```prisma
model Quack {
  id        String     @id @default(cuid())
  text      String?    @db.Text
  mood      QuackMood?
  user      User?      @relation(fields: [userId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  userId    String?
  createdAt DateTime   @default(now())
  updatedAt DateTime   @default(now()) @updatedAt
  deletedAt DateTime?
  poll      Poll?

  parentId String?
  parent   Quack?  @relation("QuackReplies", fields: [parentId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  replies  Quack[] @relation("QuackReplies")

  rootId      String?
  root        Quack?  @relation("QuackThread", fields: [rootId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  threadItems Quack[] @relation("QuackThread")

  @@index([userId, createdAt, id])
  @@index([parentId, createdAt, id])
  @@index([rootId, createdAt, id])
  @@index([rootId, deletedAt])
  @@map("quack")
}
```

- Kořen má `parentId = rootId = NULL`; jeho ID identifikuje diskusi.
- Přímá odpověď má `parentId = rootId = kořen.id`.
- Odpověď na odpověď má `parentId = adresát.id`, `rootId = adresát.rootId`.
- `replies` jsou přímé reakce; `threadItems` všechny odpovědi. Počty a stránkování používají `rootId`, ne počet přímých dětí.
- Živý quack má text, autora a `deletedAt = NULL`; smazaný má `deletedAt`, NULL text/autora/náladu a žádnou anketu.
- Index s userId nahrazuje dosavadní jednosloupcový index a pokrývá jeho prefix. Ostatní podporují feed, stránky, počty a FK.

### Povinná pravidla budoucí SQL migrace

1. CHECK: rodič a kořen jsou oba NULL, nebo oba neprázdné; ani jeden nesmí být vlastní ID.
2. CHECK: živý řádek má text a autora, smazaný má text/autora/náladu NULL. Zákaz ankety nelze vynutit CHECK nad jinou tabulkou.
3. Trigger INSERT ověří již existujícího rodiče, kořen bez rodiče a `rootId = COALESCE(parent.rootId, parent.id)`. Dopředný odkaz v hromadném insertu se nepřijímá. S neměnnými vazbami tak nevznikne cyklus.
4. Trigger zakáže změnu id, parentId, rootId a createdAt. Zakáže obnovení smazaného řádku i změnu jednou zapsaného deletedAt. Při vyčištění se aktualizuje updatedAt.
5. Triggery na Quack i Poll zabrání anketě u smazaného quacku, i při přímém INSERT/UPDATE ankety. Kontrolovaný quack zamykají tak, aby souběžné přidání ankety a vyčištění nemohly zanechat neplatný stav. Postup mazání nejprve odstraní Poll, potom vyčistí Quack.
6. Trigger odmítne fyzický DELETE quacku běžnou aplikační cestou, i pokud nemá odpovědi. Samotné Restrict chrání jen referencované řádky. Aplikační DB role nesmí pravidla obcházet pomocí TRUNCATE nebo vypnutí triggerů.
7. FK User → Quack změní Cascade na Restrict. Řízené smazání účtu musí quacky nejprve vyčistit. Trigger smazání uživatele navíc odstraní jeho PollVoterUsage; nový FK na historickou tabulku nevzniká.
8. Přechod na smazaný stav vygeneruje událost s quackId, ID diskuse a deletedAt. Pokryje i zápis autorizovaným skriptem; PostgreSQL NOTIFY ji doručí až po commitu, rollback ji nedoručí.

Zámky budou mít jednotné pořadí: při operaci s autorem nejprve uživatel, potom potřebné quacky v deterministickém pořadí, pak ankety. Hlasování se sladí s pořadím quack → anketa. Tvorbu příspěvku a mazání účtu koordinuje zámek autora. Nutné jsou testy souběhu a bezpečné řešení deadlock/serialization failure; samotný trigger bez zámků nestačí. Autorizaci nadále zajišťuje aplikace.

Prisma podporuje pojmenované self-relace a referenční akce; triggery vyžadují vlastní SQL migraci. Zdroje: [self-relace](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/relations/self-relations), [referenční akce](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/relations/referential-actions), [vlastní migrace](https://docs.prisma.io/docs/orm/prisma-migrate/workflows/unsupported-database-features), [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html), [zámky](https://www.postgresql.org/docs/current/explicit-locking.html), [NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html).

## 1. Lze vše zobrazené přečíst jednoduchými dotazy?

Ano pro data všech obrazovek: stačí FK, filtry, JOIN a agregace, bez rekurze. Výjimkou z tvrzení „vše jedním SQL dotazem“ je dosavadní relevance hledání: `domain/search-quacks.ts` dnes normalizuje diakritiku a řadí shody v paměti. Tuto logiku zachováme nad živými kandidáty; obyčejné ILIKE není rovnocenná náhrada. Indexované hledání pro velká data by bylo samostatnou změnou.

Následující dotazy jsou specifikace čtení, nikoli implementace endpointů. Parametry platí v každém bloku samostatně. DTO nesmí vracet celý řádek uživatele. Navazující dotazy v jedné odpovědi používají konzistentní snapshot, stejně jako dosavadní načítání anket.

### Feed kořenů

```sql
SELECT q.*, u.name, u.username
FROM quack q LEFT JOIN "user" u ON u.id = q."userId"
WHERE q."parentId" IS NULL
  AND (q."deletedAt" IS NULL OR EXISTS (
    SELECT 1 FROM quack a
    WHERE a."rootId" = q.id AND a."deletedAt" IS NULL
  ))
ORDER BY q."createdAt" DESC, q.id ASC;
```

### Počty živých odpovědí pro zobrazené kořeny

```sql
SELECT "rootId", COUNT(*) AS "replyCount"
FROM quack
WHERE "rootId" = ANY($1::text[]) AND "deletedAt" IS NULL
GROUP BY "rootId";
```

Chybějící kořen má počet nula. Dávkový dotaz zabrání dotazu pro každou položku zvlášť.

### „Moje“ a hledání

```sql
-- $1 = aktuální uživatel; zahrnuje kořeny i odpovědi.
SELECT q.*, u.name, u.username
FROM quack q JOIN "user" u ON u.id = q."userId"
WHERE q."userId" = $1 AND q."deletedAt" IS NULL
ORDER BY q."createdAt" DESC, q.id ASC;
```

Hledání ve „Vše“ použije stejný SELECT jen s filtrem deletedAt IS NULL; hledání v „Moje“ zachová i autora. Nad kandidáty běží dosavadní `searchQuacks`. Kontext a ankety se doplní dávkově pro výsledné položky. Smazaný kořen nebrání nalezení živé odpovědi.

### Detail a určení diskuse

```sql
-- $1 = ID libovolného quacku, včetně smazaného.
SELECT id, "rootId", "createdAt", "deletedAt",
       COALESCE("rootId", id) AS "threadId"
FROM quack WHERE id = $1;

-- $1 = threadId z předchozího dotazu.
SELECT q.*, u.name, u.username
FROM quack q LEFT JOIN "user" u ON u.id = q."userId"
WHERE q.id = $1 AND q."parentId" IS NULL;
```

Neexistující ID vrátí 404, zástupný řádek je platný detail. Náhled adresáta formuláře lze stejným JOIN načíst podle jeho ID.

### Stránka odpovědí s kontextem

```sql
-- $1 = kořen; $2 a $3 = createdAt a id poslední načtené odpovědi.
SELECT a.*, u.name, u.username,
       p.id AS "targetId", p."deletedAt" AS "targetDeletedAt",
       LEFT(p.text, 100) AS "targetPreview",
       pu.name AS "targetName", pu.username AS "targetUsername"
FROM quack a
LEFT JOIN "user" u ON u.id = a."userId"
JOIN quack p ON p.id = a."parentId"
LEFT JOIN "user" pu ON pu.id = p."userId"
WHERE a."rootId" = $1
  AND (a."createdAt", a.id) > ($2::timestamp, $3::text)
ORDER BY a."createdAt", a.id
LIMIT 21;
```

První stránka vynechá podmínku kurzoru. Server vrátí nejvýše 20 položek, 21. určí existenci další stránky. Kurzor zachová přesný čas a ID, mazání sortovací klíč nemění. DTO smazané odpovědi potlačí i její vlastní náhled rodiče; zůstane jen zástupná položka.

### Skok na stránku konkrétní odpovědi

```sql
-- $1 = cílová odpověď; kořen se otevírá přímo bez tohoto dotazu.
WITH target AS (
  SELECT id, "rootId", "createdAt" FROM quack WHERE id = $1
), page_start AS (
  SELECT (COUNT(*) / 20) * 20 AS n
  FROM quack a JOIN target t ON a."rootId" = t."rootId"
  WHERE (a."createdAt", a.id) < (t."createdAt", t.id)
)
SELECT a.*
FROM quack a JOIN target t ON a."rootId" = t."rootId"
ORDER BY a."createdAt", a.id
LIMIT 21 OFFSET (SELECT n FROM page_start);
```

Doplní se stejné JOIN na autora/rodiče jako u běžné stránky. Není potřebná rekurze; jednorázový COUNT a OFFSET mohou být u velmi dlouhých diskusí dražší než běžné pokračování kurzorem. Smazané položky zůstávají, proto mazání neposune cílovou stránku. Po skoku se pokračuje kurzorem nebo odkazem na začátek.

### Kontext nalezených odpovědí

```sql
-- $1 = ID právě zobrazených výsledků hledání či „Moje“.
SELECT a.id, a."rootId", a."parentId", p."deletedAt",
       LEFT(p.text, 100) AS "targetPreview", u.name, u.username
FROM quack a
LEFT JOIN quack p ON p.id = a."parentId"
LEFT JOIN "user" u ON u.id = p."userId"
WHERE a.id = ANY($1::text[]);
```

### Ankety, možnosti, součty a vlastní hlas

```sql
-- $1 = ID zobrazených quacků, $2 = aktuální uživatel.
SELECT p.id, p."quackId", p.question, p.revision,
       o.id AS "optionId", o.text, o.position,
       COUNT(v."userId") AS votes,
       COALESCE(BOOL_OR(v."userId" = $2), FALSE) AS "myChoice"
FROM poll p
JOIN quack q ON q.id = p."quackId" AND q."deletedAt" IS NULL
JOIN poll_option o ON o."pollId" = p.id
LEFT JOIN poll_vote v ON v."pollId" = p.id AND v."optionId" = o.id
WHERE p."quackId" = ANY($1::text[])
GROUP BY p.id, o.id
ORDER BY p.id, o.position;
```

Celkový počet a procenta se odvodí stejně jako dnes. Identity ostatních hlasujících se nevracejí. Alternativou je dosavadní Prisma `pollInclude(viewerId)` ve společném snapshotu.

### Oprávnění a předvolená nálada

```sql
SELECT role, "defaultMood" FROM "user" WHERE id = $1;
SELECT "userId", "deletedAt" FROM quack WHERE id = $2;
```

Autorizace mazání proběhne pod zámky v jeho transakci. Loading, chyba a stav spojení jsou stav klienta, ne další perzistentní data.

## 2. Je něco uložené dvakrát?

- **Ano, rootId je záměrně odvozený údaj:** lze jej zjistit z řetězce parentId, ale šetří rekurzi při každém čtení. Aplikace jej při vzniku převezme z rodiče a trigger ověří. Vazby jsou neměnné a mazání je zachová, takže další synchronizace není potřeba. Přesun větve není povolen.
- U přímé odpovědi mají parentId a rootId stejnou hodnotu, ale odlišný význam. Neukládáme navíc isReply ani další threadId.
- **Nekopírujeme text, autorovo jméno ani náhled.** Nepřidáváme automatické @jméno do obsahu. Počty odpovědí, agregované hlasy a procenta se počítají. Ručně napsaný text jiného autora je samostatný obsah, nikoli udržovaná kopie rodiče.
- Dosavadní PollUsage uchovává ID a čas ankety záměrně i po jejím odstranění. PollVoterUsage eviduje první hlasování, nekopíruje jednotlivé hlasy. Při smazání účtu jeho řádek zmizí. Dosavadní Poll.revision se dál mění ve stejné transakci s hlasem.
- Cache je dočasná kopie: mazání ji čistí, reconnect obnovuje. Události, nové logování ani analytika nesmějí ukládat odstranitelné texty a snapshoty autorství. Fyzické úložiště DB, WAL a zálohy podléhají provozní retenci; feature odstraňuje obsah z aktivních dat aplikace, nepřepisuje existující zálohy. Případná obnova zálohy musí před zpřístupněním respektovat následná smazání.

## 3. Co se stane se souvisejícími řádky?

| Řádek / relace             | Smazání quacku                                                               |
| -------------------------- | ---------------------------------------------------------------------------- |
| Quack                      | Zůstává bez obsahu a autora, má deletedAt; ID, vazby a createdAt se nemění.  |
| Odpovědi libovolné hloubky | Zůstávají beze změny, nic nekaskáduje z rodiče ani kořene.                   |
| User autora                | Zůstává; odstraní se jen vazba userId.                                       |
| Poll daného quacku         | Explicitní fyzický DELETE v transakci. UPDATE quacku samo onDelete nespustí. |
| Jeho PollOption a PollVote | Fyzicky se odstraní dosavadními kaskádami z ankety a možností.               |
| Ankety a hlasy u odpovědí  | Beze změny, patří jiným quackům.                                             |
| PollUsage                  | Zůstává, neobsahuje text.                                                    |
| PollVoterUsage             | Zůstává při smazání quacku; vlastní řádek zmizí při smazání účtu.            |
| SearchUsage, session, účty | Při smazání quacku beze změny.                                               |

Při smazání uživatele se nejprve transakčně vyčistí všechny jeho quacky včetně anket. Restrict zabrání vynechání tohoto kroku. Dosavadní kaskády pak odstraní session, účty, SearchUsage a uživatelovy hlasy v zachovaných cizích anketách. Musí se obnovit jejich součty/revize a synchronizace; cizí příspěvky a ankety zůstanou. Trigger odstraní PollVoterUsage uživatele. Současný Better Auth config nemá zapnuté uživatelské mazání účtu; story definuje bezpečnou backendovou cestu a ochranu DB bez nového UI pro mazání účtu.

## 4. Projde migrace na produkci s existujícími daty?

**Model je s existujícími daty slučitelný; migrace na konkrétní produkci zatím nebyla provedena ani otestována.** Dosavadní quacky budou živé kořeny s parentId, rootId a deletedAt NULL. Text a autor již existují. Nepřidáváme povinný sloupec bez hodnoty. Staré texty začínající @jméno nepřevádíme na odpovědi: skutečného adresáta nelze spolehlivě rekonstruovat.

Budoucí postup:

1. Na anonymizované kopii produkce prověřit migrace, FK, nestandardní řádky a zapisující skripty; zaznamenat počty quacků, anket a metrik. Nové stavové kontroly musí přijmout skutečná stará data.
2. Přidat nullable parentId/rootId/deletedAt; uvolnit NOT NULL na text/userId; přidat self-FK Restrict a nahradit User → Quack Cascade za Restrict. Nedoplňovat rootId = id u kořenů.
3. Přidat a validovat CHECK a triggery. Nezavádět nové délkové či whitespace CHECK bez prověření starých dat; tvorbu dál validuje aplikace. Historické PollVoterUsage bez existujícího uživatele před dokončením migrace odstranit, aby pravidlo platilo i pro již smazané účty; nový FK na tuto tabulku nepřidávat.
4. Vytvořit indexy a ověřit jejich platnost. U velkých tabulek oddělit souběžnou tvorbu indexů mimo transakční část, jinak počítat s blokací zápisů. Délku a rozsah zámků změřit na kopii produkce.
5. Pro tuto první verzi zvolit koordinované nasazení s pozastavením zápisů/provozu: migrace, backend i frontend chápající nullable obsah a nové mazání, pak obnovení provozu a povolení odpovědí. Starý backend nesmí fyzicky mazat ani číst zástupné řádky jako živé. Smíšené nasazení staré a nové aplikace není bez další kompatibilní fáze bezpečné.
6. Ověřit migraci z čisté DB i z kopie s daty. Počty quacků a anket i jejich obsah/autor zůstanou stejné; všechny dosavadní quacky jsou kořeny. Výjimkou je výslovný úklid historických sirotků PollVoterUsage. Ověřit FK, CHECK, triggery a indexy.
7. Smoke test: quack, odpověď na kořen i odpověď, druhá stránka a přímý skok, mazání rodiče s cizí reakcí a anketou, výpisy, dva klienti, reconnect, hlasování/mazání a smazání účtu/tvorba.

Nepoužívat produkční migrate reset ani db push. Po vzniku odpovědí a zástupných řádků starý model data neumí reprezentovat: rollback NOT NULL/Cascade není bezpečný. Řeší se opravou vpřed bez ztráty odpovědí a bez obnovy odstraněného obsahu.

## Kam změna patří a kterých featur se dotkne

### Backend

- Vlastníkem zůstane `apps/backend/src/modules/quack` / QuackModule. Nevznikne paralelní modul reply ani Thread.
- `domain/quack.ts`, DTO v `controllers/dto`, `QuacksController`, `QuacksService`, `QuackRepository`: živý/zástupný stav, rodič/kořen, výpisy, odpovědi, počty, stránkování a bezpečné mazání.
- `domain/search-quacks.ts`: pouze živí kandidáti, včetně odpovědí; zachovat diakritiku, termy a relevanci. Současné getQuacks čte vše; samotné přidání polí pravidla výpisu nezajistí.
- Návrh API: stávající POST /quacks rozšířit o parentId; GET /quacks rozlišuje all/mine a hledání; GET /quacks/:id vrací i identitu diskuse a zástupný stav; nový GET /quacks/:rootId/replies poskytne stránky a cílový skok; DELETE /quacks/:id vyčistí obsah. rootId není vstup klienta.
- `PollRepository`, `poll-result.ts`, `PollsController`: ankety u odpovědí, konzistentní zámky a ochrana před smazaným quackem. Hlasující nesmí znovu vytvořit odstraněnou anketu.
- Existující `PollEventsService` používá PostgreSQL LISTEN/NOTIFY a SSE s reconnectem a heartbeat. Rozšířit o quacky a odběr nezávislý na zobrazené anketě. Mazání účtu musí invalidovat i cizí ankety, v nichž zmizel jeho hlas. Jde o synchronizaci dat, nikoli uživatelská upozornění.
- `shared/auth` a řízená operace smazání účtu musí nejprve vyčistit quacky. `modules/settings` zůstává zdrojem jména a předvolené nálady; žádné snapshoty autora.
- `apps/backend/prisma/schema.prisma`, budoucí ruční SQL migrace a potom generovaný klient. Seed bude moci vytvářet konzistentní odpovědi, staré quacky zůstanou kořeny.
- `src/scripts/polls` a reporty: historické ankety zůstanou, počet unikátních hlasujících může po smazání účtu klesnout. SearchUsage nepřidává nové události; otevření nalezené odpovědi se zaznamená jako dosavadní otevření výsledku hledání.

### Frontend

- `apps/frontend/src/features/quack`: API schémata a query keys, načítání, useAddQuack, QuackForm, QuackItem, QuackList a QuackFeed. Typy a vykreslení musí rozlišovat živý a zástupný stav.
- Vedle `_ProtectedPages/quacks.tsx` přibude chráněný detail `/quacks/:id` s cílovou odpovědí v URL. Reload přímého odkazu otevře stejný cíl; návrat zachová filtr a hledání.
- Dosavadní QuackFeed při smazání odfiltruje celý quack a odstraní detailovou cache; to se změní podle pravidel zachování diskuse. Dosavadní otevření výsledku nad seznamem nahradí navigace do detailu.
- `api/pollSync.ts`, quackKeys a cache rozšířit o mazání quacků, stránky, počty a rodičovské náhledy. Zkontrolovat i `src/lib/quack-cache.ts` a `quack-keys.ts`, aby nevracely starý obsah. Odběr běží i bez ankety.

## Ověření při následné implementaci

- Přímá a nepřímá reakce, podvržený autor/kořen, chybný kořen přes DB, cyklus a změna již uložené vazby.
- 0/20/21 odpovědí, shodné createdAt, přímý skok mimo první stránku, zástupné položky mezi živými, správné počty všech živých reakcí.
- Smazaný kořen se živou odpovědí přes smazaného rodiče zůstane ve feedu; po smazání poslední živé reakce zmizí, přímý odkaz funguje. Nová reakce jej vrátí.
- Vyčištění textu, nálady a autora i fyzické smazání ankety/hlasů; zachování cizích odpovědí. Zákaz obnovení, přidání ankety k zástupnému quacku a fyzického DELETE.
- Oprávnění autora/admina včetně odebrání role, zákaz mazání cizích reakcí autorem kořene, opakovaný DELETE a 404.
- Dva klienti a více backendů, výpadek SSE/reconnect, opožděný HTTP výsledek po smazání, rodičovské náhledy v jiných cache. Po rollbacku žádná událost smazání.
- Skutečné DB souběhy anketa/mazání, hlas/mazání, účet/nový quack a rollback uprostřed mazání účtu. Součty a synchronizace cizích anket po odstranění hlasujícího.
- Migrace na čisté DB a s existujícími daty, žádná automatická konverze @jméno, zachování zvolených reportů.

## Mimo rozsah

Vnořený strom UI, přesuny a editace příspěvků, konverze starých zmínek, uživatelská upozornění/e-maily, serverové koncepty, správa rolí, nové UI mazání účtu, evidence důvodu a identity mazajícího, obnova obsahu, fyzický úklid prázdných diskusí a nové měření odpovědí. Nové reakce ostatních se objeví po obnovení dat; během čtení se automaticky nevkládají mezi načtené položky. Události mazání se aplikují ihned po doručení.

V dohodnutém rozsahu nezůstává otevřené produktové rozhodnutí. Schéma, SQL migrace a aplikace jsou implementované; ověření na kopii skutečné produkce a produkční nasazení zůstávají samostatným krokem.

## Stav implementace a ověření

- Implementovány odpovědi, detail a stránkování diskuse, vyhledávání/„Moje“, nevratné vyčištění a anonymní zástupné řádky, řízené backendové smazání účtu a synchronizace mazání včetně cache a náhledů.
- Migrace `20261110120000_quack_replies` a doplňující `20261110121000_protect_quack_history` chrání stav/vazby a zakazují fyzický DELETE i TRUNCATE; seed zachovává existující zástupné řádky.
- Migrace byly ověřeny přehráním v dočasné PostgreSQL databázi s existujícím příspěvkem; kontrola zachovala jeho obsah i autora. Integrační testy používají skutečné PostgreSQL a izolované HTTP relace.
- HTTP test odmítá cizí mazání (403) i nepřihlášeného uživatele (401). Při testovacím vypnutí obou autorizačních kontrol správně selhal s očekávaným 403 / skutečným 204; běžná implementace zůstala beze změny.
- Kontroly: backend/frontend lint, typy, jednotkové a integrační testy, oba buildy a formátování. Postup integračního ověření je v `e2e/README.md`.
- Playwright test je rozšířený o odpovědi a druhou otevřenou stránku. Jeho poslední běh se zastavil před vytvořením účtu, protože lokální backend na portu 4050 neběžel; úplný průchod s reálným BetterAuth a prohlížečem tedy zbývá ověřit na běžící aplikaci. Servery nebyly automaticky spouštěny.
