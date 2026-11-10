# 0001: Nevratné odstranění obsahu quacku se zachováním diskuse

## Status

Přijato — 2026-11-10. Rozhodnutí je schválené v [návrhu odpovědí](../../story.md); implementace navazuje na toto rozhodnutí; databázovou změnu obsahuje migrace `20261110120000_quack_replies`.

## Kontext

Quacky mají mít odpovědi, které mohou reagovat i na další odpovědi. Každý příspěvek patří svému autorovi: smazání rodiče nesmí odstranit cizí odpovědi, ale obsah smazaného příspěvku musí z aktivních dat aplikace skutečně zmizet.

Současný model `Quack` vyžaduje text a autora. Smazání quacku fyzicky odstraní jeho řádek a přes kaskády i anketu, možnosti a hlasy. Vazba `User → Quack` má `onDelete: Cascade`, takže smazání účtu rovněž fyzicky odstraňuje jeho příspěvky. Tyto postupy nezachovávají identitu příspěvku potřebnou pro návaznost diskuse.

Rozhodnutí o významu smazání přesahuje odpovědi: stejné pravidlo musí platit pro vlastní mazání, moderaci, smazání účtu, čtení obsahu i všechny jeho dočasné kopie. Je obtížně vratné, protože odstraněný text a autorství už nelze rekonstruovat; návrat ke starému modelu by navíc zrušil návaznosti a odkazy, které mezitím vzniknou.

## Rozhodnutí

Smazání quacku znamená nevratné odstranění jeho obsahu a autorství při zachování anonymního zástupného řádku. Není to pouhé označení obsahu za skrytý.

- V jedné transakci fyzicky odstranit případný `Poll` s možnostmi a hlasy, nastavit `Quack.text`, `mood` a `userId` na `NULL` a vyplnit `deletedAt`.
- Zachovat ID, vazby diskuse a technické časy. Nepřepisovat rodiče odpovědí. Cizí příspěvky, jejich autorství a ankety zůstávají beze změny.
- Stejný postup platí pro autora, administrátora i odstranění účtu. Smazání účtu nejprve vyčistí jeho příspěvky; autorský FK se změní z `Cascade` na `Restrict`, aby nešlo tento krok přeskočit.
- Zachovat zástupné řádky i v úplně smazané diskusi. Přímé odkazy zůstávají platné a lze na ně dále odpovídat. Zástupná položka nezobrazuje autora ani odstraněný obsah.
- Stav a nevratnost vyčištění chránit aplikací i databázovými omezeními a triggery, včetně zákazu fyzického mazání quacků běžnou aplikační cestou a přidání ankety ke smazanému quacku.
- Po commitu propagovat smazání otevřeným klientům bez původního obsahu či autora v události. Vyčistit také odvozené náhledy a cache; při obnovení spojení ověřit aktuální stav.

Toto rozhodnutí se vztahuje na životní cyklus quacků, nikoli automaticky na každou tabulku aplikace. Ankety a jejich hlasy se nadále fyzicky odstraňují. Konkrétní strukturu diskuse a pravidla výpisů rozepisuje [story](../../story.md).

## Zvažované varianty

| Varianta                                                                        | Výhody                                                                | Nevýhody a důvod přijetí či zamítnutí                                                                                                                                        |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Anonymní zástupný řádek, obsah a autorství vymazané**                         | Zachová přesnou návaznost i odkazy, odstraní obsah i vazbu na autora. | **Přijato.** Vyžaduje nullable pole, jednotné mazání a úpravu všech čtení. V databázi zůstávají technická metadata.                                                          |
| Zástupný řádek s ponechaným autorem                                             | Zachová návaznost a je zřejmé, komu lidé odpovídali.                  | Zamítnuto: i po smazání zůstává autor spojený s příspěvkem, uživatel zvolil odstranění autorství.                                                                            |
| Fyzicky odstranit quack, odpovědi přesunout k nejbližšímu zachovanému příspěvku | Nezůstávají prázdné řádky.                                            | Zamítnuto: mění adresáta odpovědí, ruší původní odkazy a nevratně ztrácí kontext. Kaskádové odstranění odpovědí je navíc přímo v rozporu s požadavkem.                       |
| Při smazání účtu zachovat obsah a jen odstranit autora                          | Diskuse zůstane plně čitelná, jednodušší anonymizace.                 | Zamítnuto: obsah zůstává v aplikaci a může autora identifikovat; mazání účtu by mělo jiný význam než mazání příspěvku.                                                       |
| Zablokovat smazání účtu s příspěvky                                             | Brání nechtěné kaskádové ztrátě diskusí.                              | Zamítnuto jako uživatelský postup: neřeší samotné vyčištění a nutí uživatele nejprve mazat jednotlivé příspěvky. `Restrict` zůstává pojistkou proti obejití řízeného mazání. |

## Důsledky

- **Datový model a čtení:** text a autor quacku budou volitelné; přibude `deletedAt`. Doménové typy, DTO, API schémata a komponenty musí odlišovat živý a zástupný stav. Samotné přidání nullable polí nezajistí integritu; budoucí SQL migrace musí dodat omezení a triggery.
- **Mazání a moderace:** dosavadní fyzický DELETE quacku nahradí transakční vyčištění. Oprávnění autora a aktuálního administrátora zůstávají; autor diskuse nezískává kontrolu nad cizími odpověďmi. Potvrzovací texty musí vysvětlit zachování diskuse a nevratnost odstranění obsahu.
- **Účty a autentizace:** odstranění uživatele musí použít řízenou transakci před odstraněním jeho řádku. Přímé smazání s nevyčištěnými quacky selže. Současný Better Auth config uživatelské mazání účtu nezapíná; rozhodnutí vyžaduje bezpečnou backendovou cestu, nepřidává nové UI účtu.
- **Ankety a reporty:** UPDATE quacku nespustí kaskádu, proto se jeho anketa odstraňuje explicitně. Při smazání účtu zmizí i jeho hlasy v cizích anketách, jejich součty/revize a synchronizace se musí aktualizovat. Podle story `PollUsage` zůstává; vlastní `PollVoterUsage` se odstraní s účtem, takže historický počet unikátních hlasujících může klesnout.
- **Feed a hledání:** hledání a „Moje“ vyloučí smazané příspěvky. Feed zachová smazaný kořen, pokud má diskuse živé odpovědi. Detail a přímé odkazy musí umět zobrazit anonymní zástupný stav. Počty se odvozují z živých odpovědí.
- **Cache a synchronizace:** smazání musí odstranit text i z náhledů rodiče v jiných odpovědích a všech dotčených cache. Opožděná HTTP odpověď nesmí obsah obnovit. SSE odběr musí fungovat i bez ankety; reconnect znovu načte aktuální data. Již doručený obsah odpojeného zařízení nelze na dálku vymazat.
- **Další zápisy a provoz:** seed, administrační skripty a budoucí featury musí respektovat stejný životní cyklus. Nevytvářet trvalé kopie textu a autorství v náhledech, událostech či novém logování. Zálohy a WAL podléhají provozní retenci; při obnově nesmí následně odstraněný obsah znovu zpřístupnit aplikace.
- **Migrace a vratnost:** existující quacky zůstanou živé a jejich obsah se migrací nemaže. Nasazení musí koordinovat databázi, backend a frontend; stará aplikace nullable obsah ani nové mazání nezvládá. Po vzniku zástupných řádků a odpovědí není bezpečný návrat ke starému `NOT NULL`/`Cascade` modelu. Preferuje se oprava vpřed, bez obnovy smazaného obsahu nebo ztráty odpovědí.

Tento ADR stanovuje trvalá pravidla životního cyklu quacků; konkrétní implementace a její testy musí tato pravidla dodržovat.
