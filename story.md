# Anketa v příspěvku

## User story

Jako uživatel chci do textového příspěvku přidat otázku s možnostmi odpovědi, aby si ostatní mohli vybrat jednu možnost a všichni viděli automaticky spočítané výsledky bez ručního počítání.

## Akceptační kritéria

1. **Vytvoření ankety**
   - Anketu může přidat každý, kdo může vytvářet příspěvky. Jeden příspěvek může obsahovat nejvýše jednu anketu.
   - Běžný text příspěvku zůstává povinný podle stávajících pravidel.
   - Anketa obsahuje povinnou otázku do 280 znaků a 2–5 povinných možností, každou do 100 znaků.
   - Mezery na začátku a konci otázky a možností se odstraní před validací. Prázdné možnosti a možnosti shodné bez ohledu na velikost písmen se odmítnou.
   - Pořadí možností odpovídá pořadí zadanému autorem.
   - Při neúspěšném zveřejnění zůstane vyplněný obsah zachovaný pro nový pokus.

2. **Zobrazení a přístup**
   - Anketa se zobrazuje v seznamu příspěvků i v detailu.
   - Výsledky jsou ihned dostupné všem, kteří mají přístup k příspěvku.
   - Hlasovat mohou přihlášení uživatelé s přístupem k příspěvku, včetně autora.
   - U každé možnosti se zobrazuje počet hlasů a procento; u ankety celkový počet hlasujících a vlastní vybraná možnost. Jména hlasujících se nezobrazují.
   - Procenta se zaokrouhlují na celá čísla nezávisle pro každou možnost; jejich součet nemusí být přesně 100 %. Bez hlasů jsou všechny počty i procenta nulové.

3. **Hlasování a změna volby**
   - Jeden uživatel má v jedné anketě nejvýše jeden uložený hlas.
   - Výběrem jiné možnosti změní svůj hlas: původní možnosti se jeden hlas odečte a nové přičte. Celkový počet hlasujících se nezmění.
   - Vlastní hlas nelze zrušit.
   - Opakované odeslání stejné volby nepřidá další hlas.
   - Při hlasování stejného uživatele z více zařízení platí poslední serverem uložená volba.
   - Souběžné hlasování nesmí způsobit ztrátu nebo zdvojení hlasů. Součet hlasů možností odpovídá celkovému počtu hlasujících.

4. **Okamžitá odezva a synchronizace**
   - Po výběru se vlastní volba a výsledky ihned přepočítají v rozhraní.
   - Během ukládání je další změna volby zablokovaná a stav ukládání je viditelný.
   - Uložený hlas se projeví v ostatních otevřených anketách do 2 sekund bez obnovení stránky, pokud mají funkční spojení.
   - Po synchronizaci zobrazují všichni stejné potvrzené výsledky.

5. **Chyby a výpadky**
   - Při potvrzené chybě uložení se rozhraní vrátí k poslednímu potvrzenému stavu, zobrazí chybu u ankety a umožní nový pokus.
   - Pokud do 10 sekund nepřijde potvrzení, rozhraní se vrátí k poslednímu potvrzenému stavu a zobrazí: „Uložení hlasu se nepodařilo ověřit.“
   - Při známém odpojení je hlasování zakázané a výsledky označené jako neaktuální.
   - Jakmile je server znovu dostupný, načte se skutečná uložená volba i aktuální výsledky a hlasování se zpřístupní.

6. **Životnost ankety**
   - Po zveřejnění nelze otázku ani možnosti upravovat.
   - Anketa nemá termín ukončení a nelze ji ručně ukončit.
   - Smazáním příspěvku se smaže také anketa a její hlasy.

7. **Ověření používání**
   - Za prvních 30 dní od zpřístupnění funkce vznikne jednorázový report pro tým obsahující:
     - počet úspěšně zveřejněných anket v tomto období;
     - podíl těchto anket, které během období získaly alespoň jeden uložený hlas;
     - počet unikátních uživatelů, kteří během období úspěšně hlasovali alespoň v jedné anketě.
   - Změny hlasu ani opakované hlasování nezvyšují počet unikátních hlasujících.
   - Pozdější smazání příspěvku metriky nesnižuje. Při nulovém počtu anket je podíl 0 %.
   - Měření neobsahuje text otázky, možnosti ani zvolenou odpověď.
   - Nové analytické rozhraní ani předem stanovený práh úspěchu nejsou součástí první verze.

V rozsahu této story nezůstává žádné otevřené produktové rozhodnutí.
