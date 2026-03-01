$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $repo "supabase\migrations\20260228001300_lottery_sync_hemp_heroes_catalog.sql"
$docsDir = Join-Path $repo "docs\lottery"

New-Item -ItemType Directory -Force -Path $docsDir | Out-Null

$lines = Get-Content -Path $sourcePath
$cards = @()
$pattern = "^\s*\((\d+), '([^']+)', '((?:[^']|'')*)', '([^']+)', '((?:[^']|'')*)', '((?:[^']|'')*)'\),?$"

foreach ($line in $lines) {
  if ($line -match $pattern) {
    $cards += [pscustomobject]@{
      cardNumber = [int]$matches[1]
      code = $matches[2]
      name = $matches[3].Replace("''", "'")
      rarity = $matches[4]
      accessoryFr = $matches[5].Replace("''", "'")
      description = $matches[6].Replace("''", "'")
    }
  }
}

$actions = @{
  1 = "The character has a majestic tree-shaped body with rainbow-colored leaves and holds a glowing earth globe between its hands."
  2 = "The character sits on a huge golden spider web, wears a superhero cape, and strikes a heroic pose."
  3 = "The character wears a majestic wizard cape and juggles several sparkling magic potion bottles."
  4 = "The character wears a colorful royal jester costume and plays a large lute on a theatrical stage."
  5 = "The character wears a leather jacket, plays an electric guitar crackling with lightning, and sings into a microphone."
  6 = "The character wears a full retro space suit, floats in zero gravity, and bites into a giant candy cane."
  7 = "The character wears a vibrant floral shirt, a Hawaiian flower lei, and sips from a coconut through a straw."
  8 = "The character wears a sports headband and triumphantly lifts enormous circus dumbbells."
  9 = "The character wears a superhero eye mask and shoots small lightning bolts from its gloved fingertips."
  10 = "The character wears a deerstalker detective hat and carefully examines a leaf with a magnifying glass."
  11 = "The character elegantly holds a large wine glass filled with sparkling cherry juice."
  12 = "The character happily presents a beautiful wrapped gift box tied with a ribbon."
  13 = "The character wears a vintage nurse headband and gently holds an oversized old-fashioned thermometer."
  14 = "The character skillfully surfs on a large stylized wave using a simple wooden board."
  15 = "The character wears a slim martial arts headband and stands in a poised fighting stance."
  16 = "The character wears small round glasses, holds a piece of chalk, and points toward a vintage blackboard."
  17 = "The character wears a small round clown nose and holds a balloon by its string."
  18 = "The character wears an elegant black lace widow veil with a mysterious vintage attitude."
  19 = "The character proudly holds a ladle dripping with a mysterious glossy sauce."
  20 = "The character carries a small wicker basket overflowing with wild strawberries."
  21 = "The character gently swings a pocket watch from side to side as if playfully hypnotizing someone."
  22 = "The character is covered with cartoon snowflakes and shivers inside a large cozy scarf."
  23 = "The character proudly raises a glowing sci-fi laser sword in a playful heroic pose."
  24 = "The character wears a small golden crown and a grand ermine royal cape, standing proudly like a tiny cartoon king."
  25 = "The character wears a thick gold chain and carries a vintage boombox on one shoulder with a cool relaxed attitude."
  26 = "The character happily eats a huge three-scoop ice cream cone that is slowly melting."
  27 = "The character has both gloved hands stuck together with thick stretchy glue and pulls hard to separate them."
  28 = "The character wears a long sleepy nightcap and lovingly hugs a small fluffy cloud."
  29 = "The character rides a pineapple fitted with small train wheels, sitting on it proudly like a silly tropical vehicle."
  30 = "The character squeezes a giant lemon with both hands, with eyes comically squinting from the sour intensity."
  31 = "The character wears a yellow construction helmet and innocently holds a large fake stick of dynamite in a playful cartoon way."
  32 = "The character wears a flowing superhero cape marked with a lemon wedge symbol and strikes a playful heroic pose."
  33 = "The character wears a vintage gas mask hanging around the neck and has a cartoon skunk tail."
  34 = "The character calmly sits cross-legged while levitating above a beautiful flying carpet."
  35 = "The character proudly holds an enormous yellow cartoon cheese wedge with large round holes."
  36 = "The character joyfully juggles three ripe mangoes in the air."
  37 = "The character proudly holds a large glowing DNA strand like a scientific discovery."
  38 = "The character holds a rustic old wooden warrior shield in a proud but simple defensive pose."
  39 = "The character gently holds a beautiful bouquet of pink flowers mixed with small wild berries."
  40 = "The character wears a vintage floral grandmother-style apron and holds a rolling pin with a warm homey attitude."
  41 = "The character lies comfortably on a tiny psychoanalyst couch while taking notes in a playful self-reflective way."
  42 = "The character wears disco bell-bottom pants and scratches an old vintage turntable with playful rhythm."
  43 = "The character wears a neat bow tie and presents a pretty ribbon-wrapped gift box with a polite cheerful smile."
  44 = "The character has small wings on its back and shoots a heart-shaped arrow with a bow in a playful cupid-like pose."
  45 = "The character rolls a large old-fashioned wooden cart wheel like a classic farm-era prop."
  46 = "The character counts on an old-fashioned abacus whose beads are bright red cherries."
  47 = "The character wears a tall magician top hat and pulls out a shiny bullet-shaped object like a stage magic trick."
  48 = "The character holds an oversized mechanic wrench with greasy hands, like a friendly old-cartoon repairman."
  49 = "The character blows with all its strength into a huge wooden alpine horn."
  50 = "The character proudly holds up a large woven dreamcatcher decorated with feathers."
  51 = "The character carries a small oriental lantern releasing a thick soft cloud of smoke."
  52 = "The character proudly leans against an old 1930s vintage gas pump with a relaxed confident attitude."
}

$rarityMood = @{
  legendary = "Legendary rarity feeling. Majestic sacred presence, mythic central composition, strongest premium aura."
  epic = "Epic rarity feeling. Theatrical heroic energy, elevated stage-like composition, premium but not divine."
  gold = "Gold rarity feeling. Premium, flashy, energetic, playful collectible mood."
  silver = "Silver rarity feeling. Elegant, refined, poised, polished vintage charm."
  common = "Common rarity feeling. Simple, charming, approachable, readable everyday cartoon energy."
}

$rarityBackground = @{
  legendary = "Clean bright minimal background with a soft vintage glow and mythic atmosphere."
  epic = "Clean bright minimal background with subtle theatrical depth and a premium heroic atmosphere."
  gold = "Clean bright minimal background with vibrant energy and a premium playful atmosphere."
  silver = "Clean bright minimal background with refined vintage atmosphere and very light decorative context."
  common = "Clean bright minimal background with a subtle vintage setting matching the prop, never cluttered."
}

$rarityOrder = @("legendary", "epic", "gold", "silver", "common")

$exportCards = foreach ($card in ($cards | Sort-Object cardNumber)) {
  $prompt = @(
    "Vertical trading card illustration, 2:3 ratio. 1930s retro cartoon style, rubber hose animation, Cuphead-inspired aesthetic."
    "Anthropomorphic CBD hemp flower character with large expressive black pie-cut eyes, a big cheerful smile, thin black noodle arms and legs, thick white worker gloves, oversized vintage shoes."
    "Very thick black outlines, clean vector-like lineart, flat colors, subtle retro halftone stippling dots for shadows."
    $rarityMood[$card.rarity]
    $actions[$card.cardNumber]
    $rarityBackground[$card.rarity]
    "No text, no logo, no border, no card frame, no watermark, no interface, no extra characters, no realistic rendering, no 3D look. Keep the character centered and highly readable for a collectible card set."
  ) -join " "

  [pscustomobject]@{
    code = $card.code
    cardNumber = $card.cardNumber
    name = $card.name
    rarity = $card.rarity
    visualPrompt = $prompt
    description = $card.description
    imageUrl = ""
    isActive = $true
  }
}

$jsonPath = Join-Path $docsDir "hemp-heroes-2026-cards.json"
$csvPath = Join-Path $docsDir "hemp-heroes-2026-cards.csv"
$mdPath = Join-Path $docsDir "hemp-heroes-2026-image-pack.md"

$exportCards | ConvertTo-Json -Depth 5 | Set-Content -Path $jsonPath -Encoding UTF8
$exportCards | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8

$md = New-Object System.Text.StringBuilder
[void]$md.AppendLine("# Hemp Heroes 2026 Image Pack")
[void]$md.AppendLine()
[void]$md.AppendLine("## Usage")
[void]$md.AppendLine()
[void]$md.AppendLine('- `hemp-heroes-2026-cards.json`: importable payload aligned with the admin card API.')
[void]$md.AppendLine('- `hemp-heroes-2026-cards.csv`: spreadsheet-friendly version of the same catalog.')
[void]$md.AppendLine("- This document: global art direction plus all 52 prompts grouped by rarity.")
[void]$md.AppendLine()
[void]$md.AppendLine("## Global Direction")
[void]$md.AppendLine()
[void]$md.AppendLine('- Format: vertical `2:3` collectible card illustration.')
[void]$md.AppendLine('- Era: `1930s retro cartoon`, `rubber hose animation`, `Cuphead-inspired aesthetic`.')
[void]$md.AppendLine('- Character base: anthropomorphic CBD hemp flower character, `large expressive black pie-cut eyes`, `big cheerful smile`, `thin black noodle arms and legs`, `thick white worker gloves`, `oversized vintage shoes`.')
[void]$md.AppendLine('- Rendering: `very thick black outlines`, `clean vector-like lineart`, `flat colors`, `subtle retro halftone stippling dots for shadows`.')
[void]$md.AppendLine("- Composition: one strong central character, one main accessory or visual gag, high readability at small size.")
[void]$md.AppendLine("- Backgrounds: bright, minimal, lightly themed, never overloaded.")
[void]$md.AppendLine()
[void]$md.AppendLine("## Rarity Rules")
[void]$md.AppendLine()
[void]$md.AppendLine('- `legendary`: sacred, singular, mythic, strongest premium aura.')
[void]$md.AppendLine('- `epic`: theatrical, heroic, elevated, dramatic but still playful.')
[void]$md.AppendLine('- `gold`: premium, flashy, energetic, vibrant and fun.')
[void]$md.AppendLine('- `silver`: refined, poised, elegant, polished vintage charm.')
[void]$md.AppendLine('- `common`: simple, immediate, friendly, one clean visual gag.')
[void]$md.AppendLine()
[void]$md.AppendLine("## Negative Prompt")
[void]$md.AppendLine()
[void]$md.AppendLine('Use this suffix for every generation: `No text, no logo, no border, no card frame, no watermark, no interface, no extra characters, no realistic rendering, no 3D look.`')
[void]$md.AppendLine()
[void]$md.AppendLine("## Prompt Library")
[void]$md.AppendLine()

foreach ($rarity in $rarityOrder) {
  [void]$md.AppendLine("### $rarity")
  [void]$md.AppendLine()

  foreach ($card in ($exportCards | Where-Object rarity -eq $rarity | Sort-Object cardNumber)) {
    [void]$md.AppendLine("#### #$($card.cardNumber) - $($card.name)")
    [void]$md.AppendLine()
    [void]$md.AppendLine("Bottom text: $($card.description)")
    [void]$md.AppendLine()
    [void]$md.AppendLine('```txt')
    [void]$md.AppendLine($card.visualPrompt)
    [void]$md.AppendLine('```')
    [void]$md.AppendLine()
  }
}

Set-Content -Path $mdPath -Value $md.ToString() -Encoding UTF8

Write-Output "Generated image pack files:"
Write-Output $jsonPath
Write-Output $csvPath
Write-Output $mdPath
