# 0002: Ukládání lajků a výpočet počtů

## Status

Přijato — 2026-11-24.

## Kontext

Přihlášený uživatel může živý quack včetně vlastního lajknout jednou a svůj lajk odebrat. Opakovaný požadavek má uspět se stejným výsledkem. Feed, detail a odpovědi potřebují celkový počet lajků a stav pro přihlášeného uživatele. Po smazání účtu mají zmizet jeho lajky i z cizích quacků. [Scénáře lajků](../../cases.md)

Prisma schéma už používá složený klíč pro jeden hlas uživatele v anketě. Smazání quacku přitom zachová jeho anonymní řádek a návaznost diskuse. Lajky tohoto quacku se musí odstranit při vyčištění obsahu, i když jeho řádek zůstane. [Prisma schéma](../../apps/backend/prisma/schema.prisma) · [ADR 0001](0001-mazani-quacku.md)

## Rozhodnutí

- Každý lajk uložíme jako jeden řádek v tabulce `Like` s cizími klíči na `Quack` a `User`. Složený primární klíč `(quackId, userId)` vynutí jeden lajk na dvojici. Index podle `userId` podpoří úklid lajků při smazání účtu.
- Celkový počet spočítáme z řádků pro zobrazované quacky. Stav tlačítka odvodíme z existence řádku přihlášeného uživatele. Feed a seznam odpovědí načtou počty a osobní stav dávkově ve stejném snímku dat.
- Přidání a odebrání pracuje s lajkem přihlášeného uživatele. Při přidání už existujícího lajku i odebrání chybějícího lajku vrátí API úspěch. U neexistujícího nebo smazaného quacku vrátí oba požadavky `404`.
- Mazání quacku odstraní jeho lajky ve stejné transakci, která nastaví `deletedAt`. Zápis lajku se s touto transakcí synchronizuje zámkem na stejném řádku quacku a ověří jeho stav po získání zámku. Pokud operace zamyká účet i quack, dodrží stávající pořadí účet před quackem.
- Při smazání účtu odstraní kaskáda z `User` i jeho lajky na cizích quacích. Zástupná položka smazaného quacku se zobrazí bez tlačítka a počtu lajků. Živé odpovědi si své lajky zachovají.

## Zvažované varianty

| Varianta                                      | Výhody                                                                                         | Nevýhody a důvod rozhodnutí                                                                                                                                         | Pozdější změna                                                                                                  |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Tabulka `Like`, počet při čtení**           | Jeden zdroj dat pro celkový počet i osobní stav. Uložené řádky stačí k ověření a úklidu lajků. | **Přijato.** Výpočet počtu zatěžuje čtení víc u silně lajkovaných quacků. Pro tuto verzi je jednodušší platit cenu agregace při čtení a udržovat jen samotné lajky. | Uložené počítadlo lze doplnit z existujících řádků. Při migraci je potřeba sladit dopočet s průběžnými zápisy.  |
| Tabulka `Like` a uložené počítadlo na `Quack` | Celkový počet je přímo na quacku. Tabulka dál zajišťuje jedinečnost a osobní stav.             | **Zamítnuto.** Každá skutečná změna řádku musí ve stejné transakci upravit i počítadlo, včetně smazání účtu. Souběžné lajky zapisují do stejného počítadla.         | Úpravy mazání nebo zápisu musí zachovat synchronizaci obou hodnot. Případný rozpor vyžaduje přepočet z tabulky. |
| Samotné počítadlo na `Quack`                  | Minimální datový model a rychlé čtení počtu.                                                   | **Zamítnuto.** Součet postrádá údaje potřebné pro jedinečnost, stav tlačítka, odebrání vlastního lajku a úklid při smazání účtu.                                    | Z dosavadních součtů nelze zpětně obnovit jednotlivé lajky.                                                     |

## Důsledky

- Existující živé quacky začnou s nulou lajků. Celkový počet a osobní stav se odvodí ze stejné tabulky. Změny od ostatních se projeví při dalším načtení.
- Čtení počtů bude procházet odpovídající řádky lajků. Pokud měření ukáže, že tím významně zpomaluje feed, lze později přidat odvozené počítadlo se zachováním stejného chování API.
- Integrační scénáře ověří vedle přidání a odebrání také opakované požadavky, oba druhy mazání a zachování lajků na živých odpovědích. [Scénáře lajků](../../cases.md)
