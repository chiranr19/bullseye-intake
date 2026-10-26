# Handing it to Russell — the messages

Russell is text-only and not technical. Three touches: a short text, an email with the links once he
answers, and a 15-minute call or a stop at the truck. Edit freely; these are drafts.

## 1. The text (send this first)

> Hi Russell, it's Chiran. I built Bullseye a free digital version of your customer form. Customers
> fill in their info, snap their insurance card and sign on their phone, and you get an email with
> everything.
>
> Try the form yourself: https://chiranr19.github.io/bullseye-intake/?ref=russell
> How it works, in 2 minutes: https://chiranr19.github.io/bullseye-intake/guide.html
>
> Send a test whenever you like. For now the tests come to me. When you're ready, I'll help you set
> it up on your own Google and GitHub accounts so everything comes straight to you. Just let me know
> a good time.

The form link is his own `?ref=russell` link, so his tests show "russell" in the sheet's Source column
and are easy to tell apart. If he asks "what's the catch": *No catch. It runs on free Google and
GitHub tools.*

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
> https://chiranr19.github.io/bullseye-intake/?ref=russell
>
> In short: a customer fills it in on their phone and signs. You get an email with their details
> and the insurance card photo, a row in a spreadsheet, and a folder with the photos. Only name,
> phone and signature are required, so it never gets in the way.
>
> Right now test entries come to me. To make it yours, we'll set it up together on your own Google
> account and a free GitHub account, which hosts the page. I'll also need the exact wording of the
> authorization on your paper form, so the signature means the same thing.
>
> When would a call or a quick stop at the truck suit you?
>
> Chiran

Attach `guide.html` from the repo if you want him to have a copy that works without the link.
It is self-contained (the QR code is drawn inside the page).

## 4. On the call or at the truck (15 minutes)

1. **Let him scan.** Hold up `qr/russell.png` on your phone. He fills in the form on his own phone
   and signs. Takes 90 seconds and makes everything below obvious.
2. **Show the email** that just arrived. Subject line, the tappable phone number, the card photo.
3. **Show the spreadsheet** on his phone (Google Sheets app). Tap the Status cell, change it.
4. **Show him the QR codes.** Flyer, truck, the card for the cab; say which is which. Print them
   only once the page has its permanent address on his GitHub account.
5. **Agree a time to set up his Google and GitHub accounts**, and get the authorization wording from
   his paper form. Until then it keeps working through your account.

Things he will ask, and the honest answers:

- *What does it cost?* Nothing. Google's free tier covers about 100 emails a day, and the form stops
  at 40 forms a day so a flood of fake ones can never use them up.
- *What if the customer has no signal?* The page keeps what they typed; they sign and send later.
- *What if they won't use a phone?* Paper, like today. Nothing depends on the form.
- *Can I change the wording / add columns?* Yes. The columns right of Source are his.
- *Who can see this?* Only him (and you, until it moves to his account). The guide's "Is it safe?"
  part explains the rest in plain words.
- *What's GitHub?* A free service that hosts the form's web page. He needs an account only so the
  page is his; Chiran can keep looking after it as a collaborator.
