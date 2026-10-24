# Ferret image prompts

30 ferrets = 6 coats x 5 poses; the accessory is `(coat + pose) % 6`, so every coat, pose and accessory appears 5-6 times. That keeps each yes/no question close to a 50/50 split.

## How to generate (Gemini / Nano Banana)

Shortcut: `python3 scripts/generate_images.py` does all of this through the Gemini API (see the README). The manual steps below work in the Gemini app.

1. Open ONE Gemini chat and use it for all 30 so the look stays consistent. Start by pasting prompt 01.
2. When you get one you like, say: "Use this exact photo style, backdrop and lighting for every ferret from now on. Keep each one the same size in frame." Then paste prompts 02-30 one at a time.
3. If a ferret drifts (wrong coat, missing accessory, cropped), reply with the fix ("the fur should be pure white, add the top hat") rather than starting over. Nano Banana edits well.
4. Check each result against its filename line: coat color, pose and accessory must match, because players answer questions from the picture.
5. Download, crop to square if needed, and save as the filename shown into `art/images/`. About 800 px square is plenty. I can add a script to resize and convert everything to WebP.

## Prompts

### 01 Bandit - Sable, Standing up, No accessory
`01-bandit.webp`

Photorealistic studio photograph of a single domestic ferret, sable coat: warm medium-brown body fur, cream undercoat, dark brown bandit mask, dark brown feet and tail tip, standing upright on its hind legs, front paws held against its chest, looking at the camera, no accessory. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 02 Noodle - Albino, Standing up, Top hat
`02-noodle.webp`

Photorealistic studio photograph of a single domestic ferret, albino coat: pure white fur, pink nose, ruby-red eyes, no mask, standing upright on its hind legs, front paws held against its chest, looking at the camera, wearing a tiny black top hat. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 03 Pickles - Silver, Standing up, Round glasses
`03-pickles.webp`

Photorealistic studio photograph of a single domestic ferret, silver coat: grey fur with white guard hairs, charcoal-grey bandit mask, dark eyes, standing upright on its hind legs, front paws held against its chest, looking at the camera, wearing small round wire-rimmed glasses. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 04 Biscuit - Cinnamon, Standing up, Red bow tie
`04-biscuit.webp`

Photorealistic studio photograph of a single domestic ferret, cinnamon coat: reddish ginger-brown fur, light tan mask, pinkish-brown nose, standing upright on its hind legs, front paws held against its chest, looking at the camera, wearing a small red bow tie. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 05 Waffles - Black sable, Standing up, Blue scarf
`05-waffles.webp`

Photorealistic studio photograph of a single domestic ferret, black sable coat: very dark brown-black fur, black bandit mask, dark eyes, standing upright on its hind legs, front paws held against its chest, looking at the camera, wearing a blue knitted scarf. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 06 Nugget - Panda, Standing up, Yellow bandana
`06-nugget.webp`

Photorealistic studio photograph of a single domestic ferret, panda coat: pure white head and shoulders, dark brown body and hindquarters, no mask, standing upright on its hind legs, front paws held against its chest, looking at the camera, wearing a yellow polka-dot bandana around its neck. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 07 Mochi - Sable, Stretched out, Top hat
`07-mochi.webp`

Photorealistic studio photograph of a single domestic ferret, sable coat: warm medium-brown body fur, cream undercoat, dark brown bandit mask, dark brown feet and tail tip, lying flat on its belly, body stretched long, chin resting on the floor, looking at the camera, wearing a tiny black top hat. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 08 Pretzel - Albino, Stretched out, Round glasses
`08-pretzel.webp`

Photorealistic studio photograph of a single domestic ferret, albino coat: pure white fur, pink nose, ruby-red eyes, no mask, lying flat on its belly, body stretched long, chin resting on the floor, looking at the camera, wearing small round wire-rimmed glasses. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 09 Tofu - Silver, Stretched out, Red bow tie
`09-tofu.webp`

Photorealistic studio photograph of a single domestic ferret, silver coat: grey fur with white guard hairs, charcoal-grey bandit mask, dark eyes, lying flat on its belly, body stretched long, chin resting on the floor, looking at the camera, wearing a small red bow tie. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 10 Ziggy - Cinnamon, Stretched out, Blue scarf
`10-ziggy.webp`

Photorealistic studio photograph of a single domestic ferret, cinnamon coat: reddish ginger-brown fur, light tan mask, pinkish-brown nose, lying flat on its belly, body stretched long, chin resting on the floor, looking at the camera, wearing a blue knitted scarf. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 11 Gizmo - Black sable, Stretched out, Yellow bandana
`11-gizmo.webp`

Photorealistic studio photograph of a single domestic ferret, black sable coat: very dark brown-black fur, black bandit mask, dark eyes, lying flat on its belly, body stretched long, chin resting on the floor, looking at the camera, wearing a yellow polka-dot bandana around its neck. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 12 Olive - Panda, Stretched out, No accessory
`12-olive.webp`

Photorealistic studio photograph of a single domestic ferret, panda coat: pure white head and shoulders, dark brown body and hindquarters, no mask, lying flat on its belly, body stretched long, chin resting on the floor, looking at the camera, no accessory. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 13 Peanut - Sable, Curled asleep, Round glasses
`13-peanut.webp`

Photorealistic studio photograph of a single domestic ferret, sable coat: warm medium-brown body fur, cream undercoat, dark brown bandit mask, dark brown feet and tail tip, curled up in a ball fast asleep, eyes closed, wearing small round wire-rimmed glasses. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 14 Fudge - Albino, Curled asleep, Red bow tie
`14-fudge.webp`

Photorealistic studio photograph of a single domestic ferret, albino coat: pure white fur, pink nose, ruby-red eyes, no mask, curled up in a ball fast asleep, eyes closed, wearing a small red bow tie. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 15 Sprout - Silver, Curled asleep, Blue scarf
`15-sprout.webp`

Photorealistic studio photograph of a single domestic ferret, silver coat: grey fur with white guard hairs, charcoal-grey bandit mask, dark eyes, curled up in a ball fast asleep, eyes closed, wearing a blue knitted scarf. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 16 Dash - Cinnamon, Curled asleep, Yellow bandana
`16-dash.webp`

Photorealistic studio photograph of a single domestic ferret, cinnamon coat: reddish ginger-brown fur, light tan mask, pinkish-brown nose, curled up in a ball fast asleep, eyes closed, wearing a yellow polka-dot bandana around its neck. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 17 Mango - Black sable, Curled asleep, No accessory
`17-mango.webp`

Photorealistic studio photograph of a single domestic ferret, black sable coat: very dark brown-black fur, black bandit mask, dark eyes, curled up in a ball fast asleep, eyes closed, no accessory. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 18 Pepper - Panda, Curled asleep, Top hat
`18-pepper.webp`

Photorealistic studio photograph of a single domestic ferret, panda coat: pure white head and shoulders, dark brown body and hindquarters, no mask, curled up in a ball fast asleep, eyes closed, wearing a tiny black top hat. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 19 Clover - Sable, Peeking out of tunnel, Red bow tie
`19-clover.webp`

Photorealistic studio photograph of a single domestic ferret, sable coat: warm medium-brown body fur, cream undercoat, dark brown bandit mask, dark brown feet and tail tip, peeking its head and front paws out of a soft grey fabric play tunnel, wearing a small red bow tie. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 20 Bean - Albino, Peeking out of tunnel, Blue scarf
`20-bean.webp`

Photorealistic studio photograph of a single domestic ferret, albino coat: pure white fur, pink nose, ruby-red eyes, no mask, peeking its head and front paws out of a soft grey fabric play tunnel, wearing a blue knitted scarf. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 21 Cocoa - Silver, Peeking out of tunnel, Yellow bandana
`21-cocoa.webp`

Photorealistic studio photograph of a single domestic ferret, silver coat: grey fur with white guard hairs, charcoal-grey bandit mask, dark eyes, peeking its head and front paws out of a soft grey fabric play tunnel, wearing a yellow polka-dot bandana around its neck. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 22 Taffy - Cinnamon, Peeking out of tunnel, No accessory
`22-taffy.webp`

Photorealistic studio photograph of a single domestic ferret, cinnamon coat: reddish ginger-brown fur, light tan mask, pinkish-brown nose, peeking its head and front paws out of a soft grey fabric play tunnel, no accessory. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 23 Pip - Black sable, Peeking out of tunnel, Top hat
`23-pip.webp`

Photorealistic studio photograph of a single domestic ferret, black sable coat: very dark brown-black fur, black bandit mask, dark eyes, peeking its head and front paws out of a soft grey fabric play tunnel, wearing a tiny black top hat. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 24 Ginger - Panda, Peeking out of tunnel, Round glasses
`24-ginger.webp`

Photorealistic studio photograph of a single domestic ferret, panda coat: pure white head and shoulders, dark brown body and hindquarters, no mask, peeking its head and front paws out of a soft grey fabric play tunnel, wearing small round wire-rimmed glasses. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 25 Maple - Sable, Mid-pounce, Blue scarf
`25-maple.webp`

Photorealistic studio photograph of a single domestic ferret, sable coat: warm medium-brown body fur, cream undercoat, dark brown bandit mask, dark brown feet and tail tip, mid-leap in a playful "weasel war dance" pounce, back arched, mouth slightly open, wearing a blue knitted scarf. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 26 Rocket - Albino, Mid-pounce, Yellow bandana
`26-rocket.webp`

Photorealistic studio photograph of a single domestic ferret, albino coat: pure white fur, pink nose, ruby-red eyes, no mask, mid-leap in a playful "weasel war dance" pounce, back arched, mouth slightly open, wearing a yellow polka-dot bandana around its neck. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 27 Cricket - Silver, Mid-pounce, No accessory
`27-cricket.webp`

Photorealistic studio photograph of a single domestic ferret, silver coat: grey fur with white guard hairs, charcoal-grey bandit mask, dark eyes, mid-leap in a playful "weasel war dance" pounce, back arched, mouth slightly open, no accessory. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 28 Juniper - Cinnamon, Mid-pounce, Top hat
`28-juniper.webp`

Photorealistic studio photograph of a single domestic ferret, cinnamon coat: reddish ginger-brown fur, light tan mask, pinkish-brown nose, mid-leap in a playful "weasel war dance" pounce, back arched, mouth slightly open, wearing a tiny black top hat. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 29 Sushi - Black sable, Mid-pounce, Round glasses
`29-sushi.webp`

Photorealistic studio photograph of a single domestic ferret, black sable coat: very dark brown-black fur, black bandit mask, dark eyes, mid-leap in a playful "weasel war dance" pounce, back arched, mouth slightly open, wearing small round wire-rimmed glasses. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.

### 30 Toast - Panda, Mid-pounce, Red bow tie
`30-toast.webp`

Photorealistic studio photograph of a single domestic ferret, panda coat: pure white head and shoulders, dark brown body and hindquarters, no mask, mid-leap in a playful "weasel war dance" pounce, back arched, mouth slightly open, wearing a small red bow tie. Entire animal in frame and centered with a little empty space around it, eye-level camera, plain seamless warm-cream backdrop, soft even studio lighting, sharp focus, natural fur detail, cute and friendly. Square 1:1. No text, no watermark, no other animals, no other props.
