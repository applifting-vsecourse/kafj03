# Lajky u quacků

Přihlášený uživatel může živému quacku dát jeden lajk a kdykoli ho odebrat. Počet u quacku zahrnuje lajky všech uživatelů. Feed dál vyžaduje přihlášení.

## Pravidla (unit testy)

### První lajk zvýší počet z 0 na 1

- **Given** Živý quack nemá žádné lajky.
- **When** Přihlášený uživatel ho lajkuje.
- **Then** Quack má jeden lajk od tohoto uživatele.

### Jeden lajk na uživatele a quack

- **Given** Uživatel už lajknul první quack a druhý quack zatím nemá žádný lajk.
- **When** Uživatel znovu lajkuje první quack a poprvé lajkuje druhý.
- **Then** První i druhý quack mají po jednom lajku.

### Každý uživatel přispívá vlastním lajkem

- **Given** Quack má jeden lajk od uživatele A.
- **When** Quack lajkuje také uživatel B.
- **Then** Quack má dva lajky, po jednom od každého uživatele.

### Autor může lajknout vlastní quack

- **Given** Přihlášenému uživateli patří quack bez lajků.
- **When** Uživatel svůj quack lajkuje.
- **Then** Quack má jeden lajk od svého autora.

### Odebrání vlastního lajku zachová lajky ostatních

- **Given** Quack lajknuli uživatelé A a B.
- **When** Uživatel A odebere svůj lajk.
- **Then** Počet klesne ze dvou na jeden. Zbývá lajk uživatele B.

### Odebrání neexistujícího lajku počet nezmění

- **Given** Uživatel A quack nelajknul. Quack má buď nula lajků, nebo jeden lajk od uživatele B.
- **When** Uživatel A požádá o odebrání svého lajku.
- **Then** Počet zůstane na výchozí hodnotě a případný lajk uživatele B zůstane zachovaný.

## Chování API (integrační testy)

### Přidání a odebrání se projeví při dalším čtení

- **Given** Přihlášený uživatel a quack bez lajků.
- **When** Uživatel přidá lajk, načte feed a detail quacku, odebere lajk a načte je znovu.
- **Then** Obě změny uspějí. Po přidání vrátí feed i detail počet `1` a stav „lajknuto“. Po odebrání vrátí počet `0` a stav „nelajknuto“.

### Opakování požadavku vrátí úspěch

- **Given** Quack má lajk od uživatele B. Přihlášený uživatel A ho dosud nelajknul.
- **When** A dvakrát požádá o přidání svého lajku a potom dvakrát o jeho odebrání.
- **Then** Všechny čtyři požadavky uspějí. Počty po jednotlivých požadavcích jsou `2`, `2`, `1`, `1`. Lajk uživatele B zůstane uložený.

### Bez přihlášení nelze měnit lajky

- **Given** Živý quack má uložený lajk.
- **When** Nepřihlášený návštěvník požádá o přidání nebo odebrání lajku.
- **Then** API vrátí `401` a uložené lajky zůstanou beze změny.

### Počet je společný a stav lajku patří přihlášenému uživateli

- **Given** Quack lajknul uživatel A. Uživatel B je také přihlášený a quack nelajknul.
- **When** Oba uživatelé načtou tentýž quack ve feedu a v detailu.
- **Then** Oba dostanou počet `1`. A dostane stav „lajknuto“ a B stav „nelajknuto“.

### Neexistující a smazaný quack vrátí `404`

- **Given** Požadavek míří buď na neexistující ID, nebo na smazaný quack, po kterém zůstala zástupná položka.
- **When** Přihlášený uživatel požádá o přidání nebo odebrání lajku.
- **Then** API ve všech kombinacích vrátí `404` a uložené lajky zůstanou beze změny.

### Smazání quacku odstraní jeho lajky

- **Given** Živý quack má lajky od dvou uživatelů a v diskuzi má živou odpověď s vlastním lajkem.
- **When** Autor quack smaže.
- **Then** Lajky smazaného quacku zmizí z databáze. Zástupná položka a odpověď zůstanou v diskuzi a lajk odpovědi zůstane uložený.

### Smazání účtu odstraní jeho lajky z cizích quacků

- **Given** Uživatel A lajknul dva quacky jiných autorů. Jeden z nich lajknul také uživatel B.
- **When** Účet uživatele A se smaže a uživatel B znovu načte oba quacky.
- **Then** Všechny lajky A zmizí. Počet u prvního quacku klesne ze dvou na jeden a u druhého z jednoho na nulu. B u prvního dál dostává stav „lajknuto“.

## End-to-end průchody

### Lajk ve feedu a jeho odebrání po obnovení stránky

- **Given** Přihlášený uživatel otevře feed a vidí quack s počtem `0` a neaktivním stavem lajku.
- **When** Klikne na tlačítko lajku a obnoví stránku. Potom klikne na stejné tlačítko znovu a stránku opět obnoví.
- **Then** Po prvním kliknutí je tlačítko ve stavu „lajknuto“ a počet je `1` před obnovením i po něm. Po druhém kliknutí je tlačítko ve stavu „nelajknuto“ a počet je `0` před obnovením i po něm.

### Lajk od jiného uživatele se projeví při dalším načtení

- **Given** Uživatel B má otevřený feed s quackem bez lajků a má vlastní přihlášenou relaci.
- **When** Uživatel A quack lajkuje ze své relace a B znovu načte feed.
- **Then** B vidí počet `1` a stav „nelajknuto“.

### Diskuze zobrazí lajk u živých odpovědí

- **Given** V diskuzi má smazaný quack zástupnou položku a pod ní je živá odpověď bez lajků.
- **When** Přihlášený uživatel otevře diskuzi a lajkuje odpověď.
- **Then** U odpovědi se zobrazí počet `1` a stav „lajknuto“. Zástupná položka se zobrazí bez tlačítka a počtu lajků.

### Při selhání zůstane poslední potvrzený stav

- **Given** Přihlášený uživatel vidí quack buď bez vlastního lajku s počtem `0`, nebo s vlastním lajkem a počtem `1`.
- **When** Klikne na tlačítko a požadavek na přidání nebo odebrání lajku selže.
- **Then** Aplikace zobrazí chybovou zprávu. Tlačítko i počet ukážou poslední potvrzený stav.
