# Implementační plán: Anketa v příspěvku

Začneme databází a spolehlivým ukládáním hlasů, potom přidáme formulář a hlasovací UI a nakonec synchronizaci. Projekt používá NestJS + Prisma + PostgreSQL a na frontendu TanStack Query. Implementace naváže na současný modul `quack`.

## Tabulky

| Tabulka            | Hlavní sloupce                                       | Pravidla                                                                                                               |
| ------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `poll`             | `id`, `quackId`, `question`, `createdAt`, `revision` | Unikátní `quackId`: nejvýše jedna anketa na příspěvek. Smazání příspěvku smaže anketu.                                 |
| `poll_option`      | `id`, `pollId`, `text`, `position`                   | Unikátní `(pollId, position)`. Smazání ankety smaže možnosti.                                                          |
| `poll_vote`        | `pollId`, `userId`, `optionId`, `updatedAt`          | Primární klíč `(pollId, userId)` zajišťuje jeden hlas. Databázová vazba musí zaručit, že možnost patří do dané ankety. |
| `poll_usage`       | `pollId`, `createdAt`, `firstVotedAt`                | Historický záznam bez textů a odpovědí; přežije smazání ankety.                                                        |
| `poll_voter_usage` | `userId`, `firstVotedAt`                             | Jeden záznam na uživatele pro počet unikátních hlasujících v měřeném období.                                           |

Počty hlasů se budou počítat z `poll_vote`, bez samostatně ukládaných čítačů. Pro první verzi tím snížíme počet míst, kde mohou vzniknout nesrovnalosti.

Záznamy pro měření se zapisují na backendu ve stejné transakci jako úspěšné vytvoření ankety nebo hlasování. Není potřeba analytický endpoint volaný z prohlížeče.

## Endpointy

| Endpoint                        | Účel                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/quacks`              | Rozšířit současné vytvoření příspěvku o nepovinné `poll: { question, options }`. Příspěvek a anketa vzniknou společně v transakci. |
| `GET /api/quacks`               | Rozšířit odpověď o anketu, možnosti, počty, celkový počet hlasujících, vlastní volbu a `revision`.                                 |
| `GET /api/quacks/:id`           | Doplnit načtení detailu příspěvku včetně ankety.                                                                                   |
| `PUT /api/quacks/:id/poll/vote` | Tělo `{ optionId }`. Vytvoří nebo změní vlastní hlas a vrátí potvrzený stav ankety.                                                |
| `GET /api/quacks/polls/events`  | SSE spojení pro oznámení změn anket bez obnovování stránky.                                                                        |
| `DELETE /api/quacks/:id`        | Doplnit mazání vlastního příspěvku, které odstraní i anketu a hlasy.                                                               |

Identitu hlasujícího vždy bereme ze session. Endpointy pro úpravu ankety, ukončení a zrušení hlasu nevytváříme.

## Konzistence hlasů a výsledků

Hlasování se zpracuje v transakci se zamknutím příslušné ankety:

1. Ověřit přístup k příspěvku a příslušnost možnosti k anketě.
2. Vložit nebo změnit hlas podle `(pollId, userId)`.
3. Při skutečné změně zvýšit `revision` a zapsat měření.
4. Načíst konzistentní výsledky a potvrdit transakci.
5. Teprve potom oznámit změnu ostatním klientům.

Opakované odeslání stejné možnosti nic nepřičte. `revision` umožní frontendu odmítnout starší odpověď, která dorazí později než novější stav.

SSE událost může obsahovat jen ID příspěvku a revizi; klient následně načte aktuální stav včetně vlastní volby. Při obnovení spojení znovu načte otevřené ankety. Pro více backendových instancí musí oznámení procházet společným kanálem, například PostgreSQL `LISTEN/NOTIFY`.

## Pořadí implementace

1. **Schéma a migrace.** Přidat tabulky, unikátní klíče, vazby a kaskádové mazání.
2. **Backend vytvoření a hlasování.** DTO validace, transakce, agregace výsledků a měření. Nejdřív ověřit souběžné hlasování skutečnými databázovými testy.
3. **Načítání a detail.** Rozšířit odpovědi a frontendová Zod schémata; doplnit detail a mazání příspěvku.
4. **Formulář ankety.** Rozšířit `QuackForm` o otázku a 2–5 možností; zachovat obsah při chybě.
5. **Hlasovací UI.** Přidat `Poll` do `QuackItem`, optimistickou změnu, blokaci během ukládání, návrat potvrzeného stavu a timeout 10 sekund.
6. **Synchronizace.** SSE, opětovné načtení po připojení, označení neaktuálních výsledků a ověření aktualizace do 2 sekund.
7. **Report a závěrečné ověření.** Skript s explicitním začátkem 30denního období; ověřit metriky i po smazání ankety.

První konkrétní krok je migrace a backend hlasování. Největší riziko story je souběh hlasů a konzistence výsledků; formulář postavíme na ověřeném API.

## Jazyk aplikace

Projekt vyžaduje anglické texty aplikace. Česká story zůstane zachovaná, ale hlášky v UI budou anglicky.
