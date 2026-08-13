# Débit, pauses, prosodie et émotion — synthèse probante

Date de revue : 15 juillet 2026.

## Conclusion opérationnelle

VoiceAct ne doit pas piloter la voix avec un seul nombre en mots par minute. Une performance vocale doit être décrite au minimum par :

1. débit global, pauses incluses ;
2. débit d'articulation, pauses exclues ;
3. débit syllabique ;
4. position et durée des pauses ;
5. courbe de hauteur fondamentale (F0) ;
6. énergie et variation d'énergie ;
7. qualité vocale ;
8. accents et groupes de sens.

Le WPM reste utile à l'écran parce qu'il est compréhensible, mais le moteur doit travailler surtout en syllabes par seconde et en événements temporels.

## Ce que les études permettent d'affirmer

### La vitesse n'est pas universelle

Le français lu a été mesuré à environ 7,18 syllabes par seconde dans une étude interlangues, mais cette moyenne ne constitue pas une cible universelle pour une voix off. Le registre, la région, l'âge, le sexe, le caractère lu ou spontané et la densité informationnelle changent le débit. Les variantes régionales du français présentent également des différences mesurables.

Sources :

- [Pellegrino, Coupé & Marsico — A cross-language perspective on speech information rate](https://gwern.net/doc/cs/algorithm/information/2011-pellegrino.pdf), niveau B.
- [Coupé et al. — Different languages, similar encoding efficiency](https://www.science.org/doi/10.1126/sciadv.aaw2594), niveau B.
- [Schwab & Avanzi — Regional variation and articulation rate in French](https://doi.org/10.1016/j.wocn.2014.10.009), niveau B.
- [Zellner — Fast and slow speech rate: a characterisation for French](https://www.isca-archive.org/icslp_1998/zellner98_icslp.html), niveau B.

Conséquence produit : VoiceAct doit calibrer le débit par rapport au profil de l'apprenant et au genre, pas sanctionner tout le monde avec une norme unique.

### Accélérer ne consiste pas à compresser uniformément

Les travaux sur le français rapide et lent montrent que le changement naturel de débit touche la durée des syllabes, les schwas, les enchaînements, les frontières et les pauses. Une simple accélération uniforme sonne artificielle.

Conséquence produit : la durée d'une phrase doit être calculée par groupes prosodiques et syllabes, puis corrigée par la ponctuation, les accents et les pauses. Le moteur actuel fondé uniquement sur le nombre de mots devra être remplacé.

### L'émotion est une constellation de paramètres

Les recherches historiques et les revues récentes convergent sur le fait que l'émotion vocale mobilise simultanément hauteur, intensité, rythme, pauses et qualité vocale. Elles ne permettent pas d'établir une règle simple du type « colère = exactement 180 WPM ».

Tendances relativement robustes :

- colère chaude / activation : F0 et intensité souvent plus élevés, attaque plus énergique et débit souvent plus rapide ;
- tristesse : énergie plus faible et débit souvent plus lent ;
- ennui : voix basse, calme et lente ;
- peur panique : hauteur élevée, mais les résultats de vitesse sont moins stables ;
- menace froide : ce n'est pas une émotion scientifique unique ; c'est une direction de jeu combinant faible énergie apparente, contrôle, hauteur contenue et pauses lourdes ;
- joie / enthousiasme : énergie et hauteur plus élevées, avec davantage de variation ;
- contenu informatif crédible : stabilité, articulation nette et variation prosodique contrôlée.

Sources :

- [Banse & Scherer — Acoustic profiles in vocal emotion expression](https://doi.org/10.1037/0022-3514.70.3.614), niveau B.
- [Juslin & Laukka — Communication of emotions in vocal expression and music performance](https://pubmed.ncbi.nlm.nih.gov/12956543/), niveau A.
- [Scherer — Vocal communication of emotion](https://doi.org/10.1016/S0167-6393(02)00084-5), niveau A.
- [The Sound of Emotional Prosody — revue de près de trois décennies](https://pmc.ncbi.nlm.nih.gov/articles/PMC12231869/), niveau A.
- [Measuring negative emotions and stress through acoustic correlates](https://pmc.ncbi.nlm.nih.gov/articles/PMC12289014/), niveau A.
- [Good vibrations — revue des émotions positives vocales](https://pmc.ncbi.nlm.nih.gov/articles/PMC7093353/), niveau A.

### Le registre modifie le bon rythme

- Publicité audio : une étude comparant 160, 180 et 200 WPM a obtenu les meilleurs résultats de traitement de l'information à 180 WPM. Cela fournit un repère pour ce type précis de publicité, pas une norme générale ni française.
- Journal parlé : les professionnels utilisent souvent un débit et une plage de hauteur supérieurs à ceux de locuteurs non professionnels. Une prosodie narrative plus respirée peut toutefois améliorer la réception par rapport à un style emphatique répétitif.
- Storytelling : les pauses participent à l'installation du suspense et du climax ; elles ne sont pas de simples temps morts.

Sources :

- [Rodero — Do Your Ads Talk Too Fast To Your Audio Audience?](https://doi.org/10.2501/JAR-2019-038), niveau B.
- [Rodero & Cores-Sarría — Best Prosody for News](https://doi.org/10.1177/00936502211059360), niveau B.
- [Nissen et al. — Prosodic Elements for Content Delivery in Broadcast Journalism](https://scholarsarchive.byu.edu/facpub/7300/), niveau B.
- [Mok et al. — Prosody of broadcast news](https://www.isca-archive.org/speechprosody_2014/mok14_speechprosody.html), niveau B.

## Plages initiales VoiceAct

Ces valeurs sont des hypothèses produit `H`, destinées au premier calibrage. Elles devront être remplacées ou affinées par les distributions des corpus francophones et par les performances réelles des utilisateurs.

| Style | WPM indicatif UI | Multiplicateur du débit personnel | Pauses dominantes | Direction principale |
|---|---:|---:|---:|---|
| Diagnostic naturel | 115–150 | 0,95–1,05 | 300–700 ms | naturel, intelligible |
| Histoire/documentaire | 120–155 | 0,90–1,05 | 350–850 ms | crédible, posé |
| Actualité dynamique | 145–180 | 1,05–1,20 | 200–550 ms | net, énergique |
| Publicité informative | 160–190 | 1,10–1,25 | 150–450 ms | dense mais compréhensible |
| Hook court énergique | 170–210 | 1,15–1,35 | 120–400 ms | attaque rapide, mots pivots |
| Horreur froide | 85–125 | 0,75–0,95 | 500–1 300 ms | retenue et attente |
| Menace contrôlée | 80–115 | 0,70–0,90 | 600–1 400 ms | calme, chute basse |
| Tristesse contenue | 80–120 | 0,70–0,95 | 500–1 200 ms | faible énergie, ruptures |
| Enthousiasme | 145–190 | 1,05–1,25 | 150–500 ms | variation et sourire vocal |

Le moteur ne doit pas forcer un débit au centre de la plage si le modèle professionnel de l'exercice possède déjà des timestamps. Dans ce cas, la référence temporelle réelle est prioritaire.

## Taxonomie des pauses du produit

Valeurs `H` à calibrer :

- micro-liaison : 120–250 ms ;
- séparation légère : 250–450 ms ;
- respiration / changement d'idée : 450–750 ms ;
- suspense : 750–1 200 ms ;
- rupture dramatique : 1 200–1 800 ms ;
- silence long : plus de 1 800 ms, seulement s'il est explicitement dirigé.

Une pause doit toujours porter une fonction : respirer, laisser comprendre, créer une image, retenir une information, préparer une révélation ou fermer une idée.

## « Hmm », « pff », souffle et autres événements

Ces éléments ne sont pas des erreurs par défaut. Les pauses remplies peuvent signaler la planification ou maintenir le tour de parole. Dans une scène, un souffle ou un « pff » peut aussi porter une intention.

VoiceAct doit les représenter comme des événements distincts :

- `breath_in` : inspiration audible ou silencieuse ;
- `breath_out` : expiration ;
- `hmm_short` : hésitation/réaction brève ;
- `hmm_hold` : réflexion tenue ;
- `pff` : rejet, fatigue ou relâchement selon le contexte ;
- `laugh`, `sob`, `swallow`, `gasp` ;
- `silence` : aucun son attendu.

Leur durée cible doit provenir d'une référence enregistrée ou d'une direction humaine. Il serait faux de leur attribuer une durée universelle.

Sources :

- [Clark & Fox Tree — Using uh and um in spontaneous speaking](https://www.cs.columbia.edu/~sbenus/Teaching/APTD/FoxTree_pauses_turn-exchages_2002.pdf), niveau B.
- [What makes a good pause?](https://arxiv.org/abs/2305.02101), niveau B.

## Pédagogie validée

Le shadowing — écouter puis reproduire un modèle — dispose d'un soutien raisonnable pour la fluidité, l'intelligibilité et certains aspects de la prosodie. Les preuves sont moins nettes pour la correction fine des phonèmes et les comparaisons avec d'autres méthodes restent insuffisantes.

Les retours visuels de hauteur peuvent aider l'apprentissage de l'intonation, mais l'écran doit montrer une cible simple et une différence actionnable, pas un graphique d'ingénieur.

Le « stylo dans la bouche » ne doit pas être présenté comme une technique validée : les revues sur les exercices oromoteurs non verbaux trouvent des preuves insuffisantes de transfert vers la parole. VoiceAct privilégiera donc des exercices qui produisent réellement de la parole : surarticulation, contrastes consonantiques, virelangues, shadowing ralenti puis normal et réécoute comparative.

Sources :

- [Whitworth & Rose — systematic review of shadowing](https://doi.org/10.1080/29984475.2025.2546827), niveau A.
- [Mahdi & Al Khateeb — effectiveness of computer-assisted pronunciation training](https://eric.ed.gov/?id=EJ1231516), niveau A.
- [Lee & Gibbon — visualisation of pitch contours](https://doi.org/10.1016/0167-6393(84)90037-2), niveau B.
- [ASHA — review of nonspeech oral motor exercises](https://doi.org/10.1044/1058-0360(2009/09-0006)), niveau A.

## Principe de formulation des retours

VoiceAct ne dit pas : « Tu es triste à 82 %. »

VoiceAct dit : « Ta performance correspond à 82 % à la cible : ralentis la deuxième intention, réduis l'énergie et conserve 800 ms de silence avant la reprise. »
