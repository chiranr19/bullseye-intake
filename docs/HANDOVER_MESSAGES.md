# Handing it to Russell — the messages

Russell is text-only and not technical. Three touches: a short text, an email with the links once he
answers, and a 15-minute call or a stop at the truck. Edit freely; these are drafts.

## 1. The text (send this first)

> Hi Russell, it's Chiran. I built Bullseye a free digital version of your customer form. Customers
> scan a QR code or tap a link, fill in their info, snap their insurance card and sign on their phone.
> You get an email with everything, and a spreadsheet tracks each job. 2-minute picture guide:
> https://chiranr19.github.io/bullseye-intake/guide.html
>
> Can I show you how it works? Send me your email or a good time for a quick call.

If he asks "what's the catch": *No catch. It runs on free Google tools.*

## 2. The QR code photo (send once he has seen the guide)

Attach `qr/russell.png` and add one line:

> This is your QR code. Save it to your photos. At the car, show it on your screen and the customer
> points their phone camera at it. The form opens on their phone.

A texted photo of the code still scans: it was tested after shrinking to 180 pixels, heavy
compression, blur and a tilt. Two limits:

- A phone cannot scan a code shown on its own screen. To reach a customer by text, send the link
  (`https://chiranr19.github.io/bullseye-intake/?ref=text`), not the picture.
- The code holds today's address. If the page moves to its own address (README, "Moving the page"),
  the old address must keep redirecting, or this saved photo stops working.

## 3. The email, once he replies

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

## 4. On the call or at the truck (15 minutes)

1. **Let him scan.** Hold up `qr/russell.png` on your phone. He fills in the form on his own phone
   and signs. Takes 90 seconds and makes everything below obvious.
2. **Show the email** that just arrived. Subject line, the tappable phone number, the card photo.
3. **Show the spreadsheet** on his phone (Google Sheets app). Tap the Status cell, change it.
4. **Hand over the QR codes.** Flyer, truck, the card for the cab. Say which is which.
5. **Agree the two things you need** (Gmail address, authorization wording) and when you'll move
   it over. Until then it keeps working through your account.

Things he will ask, and the honest answers:

- *What does it cost?* Nothing. Google's free tier covers about 100 emails a day, and the form stops
  at 40 forms a day so a flood of fake ones can never use them up.
- *What if the customer has no signal?* The page keeps what they typed; they sign and send later.
- *What if they won't use a phone?* Paper, like today. Nothing depends on the form.
- *Can I change the wording / add columns?* Yes. The columns right of Source are his.
- *Who can see this?* Only him (and you, until it moves to his account). The guide's "Is it safe?"
  part explains the rest in plain words.
