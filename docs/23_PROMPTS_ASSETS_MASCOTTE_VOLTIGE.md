# VoiceAct — prompts d'assets pour la Voltige vocale

Version : 1.0 — 24 juillet 2026

## Direction artistique retenue

Nom provisoire : **Voxi**.

Voxi est un petit esprit du son, non genré, à la silhouette originale :

- corps arrondi en forme de goutte/bulle de dialogue ;
- deux petites nageoires-oreilles mobiles qui lui permettent de voler ;
- courte queue en ruban dont la forme rappelle une onde sonore ;
- grands yeux expressifs ;
- petit symbole de pulsation vert citron sur le torse ;
- aucune plume, aucun bec et aucune ressemblance avec une chouette ;
- formes simples, faciles à redessiner en vectoriel et à animer.

Palette :

- violet profond `#3B1B72` ;
- violet clair `#9B6CFF` ;
- vert électrique `#A3F52B` ;
- crème `#F7F4EE` ;
- corail `#FF5F6D` uniquement pour les réactions et alertes.

Style :

- illustration 2D vectorielle premium ;
- contours propres et souples ;
- ombrage cell-shading très léger ;
- formes lisibles sur un écran mobile ;
- chaleureux, malicieux et rassurant ;
- aucun texte intégré aux images.

## Règle de génération

Le prompt 1 crée la référence maîtresse. Tous les prompts suivants doivent utiliser cette image en référence avec la consigne de préserver exactement :

- forme de la tête et du corps ;
- proportions ;
- couleurs ;
- yeux ;
- symbole du torse ;
- nageoires-oreilles ;
- queue en onde sonore.

Ne pas générer toutes les poses indépendamment sans référence, sinon le personnage changera d'un écran à l'autre.

---

## Prompt 1 — création de la mascotte maîtresse

```text
Create a completely original mascot character for “VoiceAct”, a playful voice-training application.

CHARACTER CONCEPT
The character is named Voxi, a tiny gender-neutral sound spirit. Voxi is not a known animal. Its body has a soft rounded speech-bubble or teardrop silhouette, with two small floating ear-fins used for flying and a short ribbon tail shaped like a smooth audio waveform. Voxi has large expressive dark-purple eyes, a tiny friendly mouth, and a small abstract lime-green pulse symbol on the chest. The silhouette must remain recognizable at 48 pixels.

PERSONALITY
Warm, mischievous, encouraging, curious and brave. Voxi celebrates effort, never mocks failure, and feels like a friendly vocal coach rather than a baby character.

ART DIRECTION
Premium 2D vector mascot, clean rounded shapes, subtle soft cel shading, minimal texture, modern mobile-game polish, expressive but not childish, easy to rig and animate. Strong silhouette, limited color palette, no tiny decorative details.

COLOR PALETTE
Deep plum purple #3B1B72, bright lavender #9B6CFF, electric lime #A3F52B, warm cream #F7F4EE, with coral #FF5F6D used only as a tiny accent.

CHARACTER SHEET
Show the exact same character in front view, three-quarter view, side view and back view. Add one neutral standing pose and one gentle hovering pose. Include simple palette swatches without written labels. Keep all views at the same scale and preserve identical proportions.

COMPOSITION
Square 2048 × 2048 character design sheet, clean warm-gray background, generous spacing, every body part fully visible, no cropped limbs or fins.

IMPORTANT
The design must be fully original. No owl, no bird beak, no feathers, no green bird mascot, no resemblance to Duolingo or any existing entertainment character. No letters, no words, no logo text, no watermark, no photorealism, no realistic fur, no complex 3D rendering, no extra limbs, no clothing.
```

---

## Prompt 2 — version neutre prête à détourer

Joindre l'image maîtresse validée.

```text
Using the attached approved Voxi master character as the strict identity reference, create one clean full-body neutral hovering pose.

Preserve the exact face, body proportions, eye shape, ear-fins, waveform tail, chest pulse symbol and approved colors. Voxi faces three-quarter right, floats naturally with relaxed ear-fins, arms slightly away from the torso, tail fully visible, friendly neutral expression.

Premium flat 2D vector illustration, very clean closed shapes, minimal cel shading, no texture, no motion blur, no glow covering the silhouette. The asset must be easy to trace into SVG and separate into riggable layers.

Centered full body, transparent background, 2048 × 2048 PNG, generous transparent margin, no ground shadow, no text, no additional objects, no cropping, no alternate costume, no design changes.
```

---

## Prompt 3 — feuille des poses de vol

Joindre l'image maîtresse validée.

```text
Using the attached approved Voxi master character as a strict identity reference, create a six-panel animation key-pose sheet. The exact same character and proportions must appear in every panel.

POSE 1 — calm forward flight, body almost horizontal, relaxed smile.
POSE 2 — gently climbing, eyes looking toward an upper ring, ear-fins pushing downward.
POSE 3 — gently descending, body tilted slightly down, waveform tail curving upward.
POSE 4 — gliding during a breathing pause, eyes softly closed, relaxed body, no falling.
POSE 5 — passing cleanly through a ring, focused joyful expression, streamlined pose.
POSE 6 — short happy celebration, small fist pump, ear-fins open, bright smile.

Keep each pose readable at mobile-game size. Use clean premium 2D vector shapes, subtle cel shading, no complex background, no exaggerated squash that changes the character identity.

Wide 4096 × 2048 image, two rows of three equally spaced panels, transparent background, no panel borders, no text, no numbers, no rings, no particles, no cropping, no extra limbs, no inconsistent colors.
```

---

## Prompt 4 — expressions faciales

Joindre l'image maîtresse validée.

```text
Using the attached approved Voxi master character as a strict identity reference, create an eight-expression facial reference sheet. Show the same head angle and identical proportions in every expression.

EXPRESSIONS
1. welcoming and ready;
2. curious;
3. gently focused;
4. pleasantly surprised;
5. proud celebration;
6. encouraging after an imperfect attempt;
7. calm breathing and recovery;
8. concerned but kind, used only when the microphone or voice check needs attention.

The “imperfect attempt” expression must never look disappointed, mocking or sad. Voxi always encourages another try.

Premium clean 2D vector illustration, large readable eyes, subtle mouth changes, ear-fins participating in the expression, limited approved color palette.

Square 3072 × 3072 sheet, two rows of four heads, transparent background, consistent lighting, no text, no icons, no tears, no anger, no humiliation, no character redesign.
```

---

## Prompt 5 — poses de l'écran de score

Joindre l'image maîtresse validée.

```text
Using the attached approved Voxi master character as a strict identity reference, create three separate full-body result-screen poses of the same character.

POSE A — excellent daily control: Voxi floats proudly with a joyful but not excessive celebration, one ear-fin raised, warm smile.
POSE B — useful daily warm-up completed: Voxi gives a friendly approving gesture, relaxed and confident.
POSE C — noisy or difficult attempt: Voxi remains supportive, holds out one hand inviting another try, gentle encouraging smile, absolutely no disappointment.

Leave a clean empty area above and to the right of Voxi for the application to animate the numeric score and buttons. Do not place a score, number, medal or text inside the image.

Premium 2D vector mobile-game illustration, subtle cel shading, transparent background, full body visible, consistent approved colors and proportions.

Wide 4096 × 2048 image with three clearly separated characters, transparent background, no text, no numbers, no UI, no trophy, no confetti baked into the image, no character redesign.
```

---

## Prompt 6 — portrait pour navigation et notifications

Joindre l'image maîtresse validée.

```text
Using the attached approved Voxi master character as a strict identity reference, create a close-up mascot portrait for a mobile application avatar.

Voxi looks directly at the user with a welcoming, alert and slightly mischievous expression. Show the full head, both ear-fins, the upper chest and the lime pulse symbol. Preserve the exact approved proportions and palette.

Clean premium 2D vector icon, strong silhouette, simple lighting, readable at 32 pixels, no tiny details.

Square 1024 × 1024, transparent background, centered, generous margin, no circular frame, no text, no letters, no watermark, no additional objects.
```

---

## Prompt 7 — décor panoramique optionnel

Le décor peut être construit en motion design. Ce prompt ne sert que si l'on veut une base illustrée plus organique.

```text
Create a seamless panoramic background for a gentle mobile voice warm-up game. No character and no gameplay objects.

SCENE
An abstract “sound sky” at early morning: deep plum at the far edges transitioning toward lavender and warm cream near the center, soft rounded clouds, a few distant floating islands shaped by subtle sound-wave curves, gentle luminous atmosphere, calm and optimistic.

ART DIRECTION
Premium 2D vector background, very low visual noise, broad simple shapes, subtle depth for parallax, no realistic landscape, no complex texture. Keep the central horizontal flight corridor uncluttered and high contrast so a purple mascot and lime rings remain perfectly readable.

COMPOSITION
Ultra-wide 4096 × 1024 seamless panorama. Safe central region compatible with both horizontal desktop cropping and vertical mobile cropping. Separate-looking foreground, midground and background forms without visible layer boundaries.

No character, no rings, no text, no UI, no numbers, no musical notes, no microphones, no logos, no watermark.
```

---

## Ce qui doit rester en motion design

Ne pas faire générer par une IA :

- les cerceaux et leurs états ;
- la trajectoire cible ;
- les lignes de hauteur ;
- les sons-guides et leur défilement ;
- le score et les nombres ;
- les boutons « Recommencer » et « Continuer » ;
- les particules de réussite ;
- le halo de tolérance ;
- la jauge de progression ;
- les changements de couleur liés à la précision ;
- les mouvements de caméra et le parallaxe.

Ces éléments doivent rester en SVG, Canvas ou CSS afin d'être nets, responsives, synchronisés au moteur audio et faciles à modifier.

## Durée du rituel MVP

Il n'existe pas de durée universelle scientifiquement démontrée comme idéale pour tous les utilisateurs. Le MVP adopte donc une dose courte et prudente :

- check-in : 5 à 8 secondes ;
- calibration : 8 à 12 secondes, repos inclus ;
- démonstration : 8 secondes ;
- trois vols de 10 à 12 secondes ;
- deux repos de 5 secondes ;
- résultat : 8 à 12 secondes.

Durée totale : **75 à 90 secondes**, dont seulement **30 à 40 secondes de phonation**.

## Score du jour

Le score ne récompense ni la hauteur maximale ni le volume.

- précision relative de trajectoire : 45 % ;
- fluidité des montées et descentes : 25 % ;
- continuité dans les zones où un son est demandé : 20 % ;
- respect des repos et des départs : 10 %.

Le bruit ou une détection insuffisante produit « mesure non fiable », pas une mauvaise note.

À la fin, les deux actions restent toujours disponibles :

- **Recommencer** ;
- **Continuer le cursus**.

Un score faible ne bloque jamais la séance. Il sert de mesure quotidienne et peut légèrement adapter la difficulté de la Voltige du lendemain.
