# Make.com Invite Email Setup Guide

## Step 1: Create New Scenario in Make.com

1. Log in to Make.com
2. Create a new scenario
3. Add **Webhooks** → **Custom webhook** as the trigger

## Step 2: Configure Webhook

1. Click on the webhook module
2. Click **Add** to create a new webhook
3. Name it: "Narrin AI Invite"
4. Copy the webhook URL (looks like: `https://hook.eu2.make.com/xxxxxxxxxxxxx`)

## Step 3: Add Webhook URL to Netlify

1. Go to Netlify Dashboard → **Site settings** → **Environment variables**
2. Add new variable:
   - Key: `MAKE_INVITE_WEBHOOK_URL`
   - Value: [paste your webhook URL from Make.com]

## Step 4: Test Webhook Data Structure

Send a test from your profile page, then in Make.com:
1. Click "Run once" on your scenario
2. Send an invite from profile.html
3. Make.com will receive this data structure:

```json
{
  "invitee_email": "friend@example.com",
  "inviter_email": "user@example.com",
  "invite_link": "https://narrin.ai?ref=invite",
  "timestamp": "2025-08-02T16:30:00Z"
}
```

## Step 5: Add Email Module

1. Add a new module: **Email** → **Send an Email**
2. Configure:
   - **To**: `{{invitee_email}}`
   - **Subject**: `{{inviter_email}} invited you to join Narrin AI! 🎉`
   - **Content Type**: HTML
   - **Content**: (paste the HTML below)

```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { 
            background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
            border-radius: 10px 10px 0 0;
        }
        .header h1 { margin: 0; font-size: 36px; font-weight: 800; }
        .content { 
            background: #f9f9f9; 
            padding: 40px 30px; 
            border-radius: 0 0 10px 10px;
        }
        .button { 
            display: inline-block; 
            background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); 
            color: white !important; 
            padding: 18px 36px; 
            text-decoration: none; 
            border-radius: 16px; 
            font-size: 18px;
            font-weight: 700;
            margin: 30px 0;
        }
        .features {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
        .footer { 
            text-align: center; 
            margin-top: 30px; 
            color: #666; 
            font-size: 14px; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Narrin AI</h1>
            <p style="margin: 10px 0; font-size: 20px;">You've been invited!</p>
        </div>
        
        <div class="content">
            <h2>Hi there! 👋</h2>
            
            <p><strong>{{inviter_email}}</strong> thinks you'll love chatting with our AI characters.</p>
            
            <p>Narrin AI gives you access to over 1000+ unique AI characters, each with their own personality and expertise. From creative companions to expert advisors, there's always someone interesting to talk to!</p>
            
            <center>
                <a href="{{invite_link}}" class="button">Accept Invitation & Join</a>
            </center>
            
            <div class="features">
                <h3>What you'll get:</h3>
                <ul>
                    <li>🤖 1000+ unique AI characters</li>
                    <li>💬 50 free messages every month</li>
                    <li>🧠 Smart memory system</li>
                    <li>✨ Personalized conversations</li>
                </ul>
            </div>
            
            <p>Ready to start your journey? Click the button above to create your free account!</p>
            
            <p><strong>See you inside!</strong><br>The Narrin AI Team</p>
        </div>
        
        <div class="footer">
            <p>This invitation was sent by {{inviter_email}}</p>
            <p>© 2025 Narrin AI. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
```

## Step 6: Configure Email Connection

1. Click **Add a connection**
2. Choose your email service:
   - **Gmail**: Connect your Google account
   - **Outlook**: Connect your Microsoft account
   - **SMTP**: Use custom email server

## Step 7: Save and Activate

1. Click **Save** on the scenario
2. Toggle the scenario **ON**
3. Test by sending an invite from profile.html

## Webhook Data Reference

Your webhook receives:
- `invitee_email` - The friend's email address
- `inviter_email` - Who sent the invite
- `invite_link` - The signup link with referral
- `timestamp` - When the invite was sent

## Troubleshooting

- Check Netlify Function logs for errors
- Verify the webhook URL is correct in environment variables
- Make sure the scenario is turned ON
- Check Make.com execution history for details