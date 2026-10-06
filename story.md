# Hledání příspěvků

## User story

Jako uživatel chci hledat příspěvky podle slov z jejich textu nebo jména autora, abych znovu našel příspěvek, který jsem dříve viděl.

## Akceptační kritéria

1. Vyhledávací pole je nad hlavním seznamem a filtruje všechny příspěvky dostupné uživateli, včetně dosud nenačtených.
2. Po zadání neprázdného dotazu se výsledky automaticky aktualizují bez Enteru nebo tlačítka.
3. Hledání ignoruje velikost písmen a diakritiku a podporuje části slov. Například „zlut“ najde text „Žlutý“ a „pet“ najde autora „Petr“.
4. Výsledek musí obsahovat všechna zadaná slova. Slova mohou být rozdělená mezi text příspěvku a jméno autora. Například „Petr výlet“ najde příspěvek autora Petra s textem obsahujícím „výlet“.
5. Výsledky se řadí: přesná fráze → všechna hledaná slova jako celá slova → shody obsahující části slov. Při stejné kategorii shody je novější příspěvek první bez ohledu na to, zda je shoda v textu nebo ve jméně autora.
6. Mezery na začátku a konci se ignorují. Prázdný dotaz nebo samotné mezery obnoví běžný seznam.
7. Během hledání se zobrazí indikátor načítání.
8. Bez výsledků se zobrazí „Žádné příspěvky neodpovídají hledání“.
9. Při chybě se zobrazí informace o selhání a možnost hledání zopakovat.

## Technický parametr

Hledání se spouští od prvního znaku s prodlevou 300 ms od posledního psaní.

## Měření první verze

Během prvních 4 týdnů od nasazení sledujeme:

- Podíl aktivních uživatelů, kteří dokončí alespoň jedno hledání s neprázdným dotazem. Aktivní uživatel je ten, kdo v tomto období otevře hlavní seznam příspěvků.
- Podíl hledajících uživatelů, kteří otevřou alespoň jeden výsledek hledání.

Obsah dotazů se neukládá. Zatím pouze sbíráme data, bez stanovené hranice úspěchu.

## Mimo rozsah

- Našeptávání.
- Historie hledání.
- Zvýrazňování shod.
- Další filtry.
