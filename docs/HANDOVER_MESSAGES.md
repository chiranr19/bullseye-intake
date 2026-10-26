# Handing it to Russell — the messages

Russell is text-only and not technical. Three touches: a text to open the door, an email with
the links once he answers, and a short call or a visit to the truck. Edit freely; this is a draft.

## 1. The first text

> Hey Russell, it's Chiran. I built something for Bullseye and I'd like to give it to you, free.
> It's a digital version of your customer form. A customer scans a QR code or taps a link, fills
> in their details and insurance card on their phone, signs with their finger, and you get an
> email with everything.
>
> I'd like to show you how it works. Could you send me an email address, or tell me a good time
> for a 15-minute call?

If he asks "what's the catch": *No catch. It runs on free Google tools. I wanted to build it and
you were the right person to build it for.*

## 2. The email, once he replies

**Subject:** Your new customer form — how it works

> Hi Russell,
>
> Here is the customer form I mentioned. Two links:
>
> **How it works (2-minute read, pictures):**
> https://chiranr19.github.io/bullseye-intake/guide.html
>
> **Try the form yourself (it's live, send a test if you like):**
> https://chiranr19.github.io/bullseye-intake/?ref=text
>
> In short: a customer fills it in on their phone and signs. You get an email with their details
> and the insurance card photo, a row in a spreadsheet, and a folder with the photos. Only name,
> phone and signature are required, so it never gets in the way.
>
> Right now test entries come to me. To move it to you I need two things:
>
> 1. The Gmail address you want the emails to go to (a free Gmail account is enough).
> 2. The exact wording of the authorization on your paper form, so the signature means the same thing.
>
> When would a call or a quick stop at the truck suit you? I'll bring the printed QR codes.
>
> Chiran

Attach `guide.html` from the repo if you want him to have a copy that works without the link.
It is self-contained (the QR code is drawn inside the page).

## 3. On the call or at the truck (15 minutes)

1. **Let him scan.** Hold up `qr/russell.png` on your phone. He fills in the form on his own phone
   and signs. Takes 90 seconds and makes everything below obvious.
2. **Show the email** that just arrived. Subject line, the tappable phone number, the card photo.
3. **Show the spreadsheet** on his phone (Google Sheets app). Tap the Status cell, change it.
4. **Hand over the QR codes.** Flyer, truck, the card for the cab. Say which is which.
5. **Agree the two things you need** (Gmail address, authorization wording) and when you'll move
   it over. Until then it keeps working through your account.

Things he will ask, and the honest answers:

- *What does it cost?* Nothing. Google's free tier covers about 100 emails a day.
- *What if the customer has no signal?* The page saves what they typed; they can send later.
- *What if they won't use a phone?* Paper, like today. Nothing depends on the form.
- *Can I change the wording / add columns?* Yes. The columns right of Source are his.
- *Who can see this?* Only him (and you, until it moves to his account).
