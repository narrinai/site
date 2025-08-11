# Avatar Automation Setup

## Automatisch avatars vernieuwen met Replicate

Deze setup zorgt ervoor dat avatars dagelijks automatisch worden vernieuwd voordat ze verlopen.

## Waarom?
- Replicate URLs verlopen na 24 uur
- Door dagelijks te vernieuwen blijven avatars altijd beschikbaar
- Volledig automatisch, geen handmatige acties nodig

## Setup instructies

### Stap 1: Voeg environment variable toe in Netlify
Voeg een geheime sleutel toe voor beveiliging (optioneel maar aanbevolen):
```
CRON_SECRET=een-geheime-sleutel-die-je-zelf-kiest
```

### Stap 2: Kies een gratis cron service

#### Optie A: Cron-job.org (Aanbevolen - Gratis)
1. Ga naar https://cron-job.org/
2. Maak een gratis account
3. Maak een nieuwe cron job:
   - **URL**: `https://narrin.ai/.netlify/functions/regenerate-avatars?secret=jouw-geheime-sleutel`
   - **Schedule**: Daily at 03:00 (of een tijd naar keuze)
   - **Method**: GET
   - **Enable**: Yes

#### Optie B: EasyCron (Gratis tier)
1. Ga naar https://www.easycron.com/
2. Maak een gratis account (1920 executions/month gratis)
3. Add Cron Job:
   - **URL**: `https://narrin.ai/.netlify/functions/regenerate-avatars?secret=jouw-geheime-sleutel`
   - **Cron Expression**: `0 3 * * *` (dagelijks om 3:00)
   - **HTTP Method**: GET

#### Optie C: UptimeRobot (Gratis - creatieve oplossing)
1. Ga naar https://uptimerobot.com/
2. Maak een gratis account
3. Add New Monitor:
   - **Monitor Type**: HTTP(s)
   - **URL**: `https://narrin.ai/.netlify/functions/regenerate-avatars?secret=jouw-geheime-sleutel`
   - **Monitoring Interval**: 24 hours

#### Optie D: GitHub Actions (Als je GitHub Pro hebt)
Maak `.github/workflows/regenerate-avatars.yml`:
```yaml
name: Regenerate Avatars Daily

on:
  schedule:
    - cron: '0 3 * * *'  # Daily at 3 AM UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  regenerate:
    runs-on: ubuntu-latest
    steps:
      - name: Call regenerate function
        run: |
          curl -X GET "https://narrin.ai/.netlify/functions/regenerate-avatars?secret=${{ secrets.CRON_SECRET }}"
```

### Stap 3: Test de setup
Test handmatig door deze URL te bezoeken:
```
https://narrin.ai/.netlify/functions/regenerate-avatars?secret=jouw-geheime-sleutel
```

## Wat doet het script?
Het script draait dagelijks en:
1. Zoekt alle characters met:
   - Lege avatar URLs
   - Replicate URLs (herkenbaar aan 'replicate.delivery')
   - Avatars ouder dan 20 uur
2. Genereert nieuwe avatars via Replicate
3. Slaat de nieuwe URLs op in Airtable
4. Houdt bij wanneer avatars gegenereerd zijn

## Monitoring
Check de Netlify Functions logs om te zien of het script succesvol draait:
1. Ga naar Netlify Dashboard
2. Functions → regenerate-avatars
3. View logs

## Kosten
- **Cron services**: Gratis
- **Replicate**: Betaald per avatar generatie (ongeveer $0.0011 per avatar)
- **Netlify Functions**: 125k requests/month gratis

## FAQ

**Q: Hoe vaak moet het draaien?**
A: Dagelijks is voldoende. Het script regenereert avatars die binnen 4 uur verlopen.

**Q: Wat als het script faalt?**
A: Het probeert de volgende dag opnieuw. Avatars zijn maximaal een paar uur niet beschikbaar.

**Q: Kan ik het handmatig triggeren?**
A: Ja, bezoek de URL met je secret parameter.

**Q: Hoeveel avatars kan het per keer verwerken?**
A: Maximaal 50 per run om timeouts te voorkomen.

## Alternatief: Permanente opslag
Als je liever permanente opslag wilt, gebruik dan de `auto-save-avatar` functie met:
- ImgBB (gratis CDN)
- Imgur (gratis CDN)
- Cloudinary (gratis tier)

Zie `/netlify/functions/auto-save-avatar.js` voor details.