# ============================================
# DataLab atirbi — API Python (FastAPI)
# Endpoints: contact, analyse fichiers, facturation
# ============================================

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from typing import Optional
import pandas as pd
import io
import json
import os
import httpx
from datetime import datetime

app = FastAPI(
    title="DataLab atirbi API",
    description="API officielle DataLab atirbi — Analyse de données, Contact, Facturation",
    version="1.0.0"
)

# CORS — autoriser le site web
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://datalab.atirbi.com", "https://atirbi.com", "http://localhost:*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- MODÈLES ----
class ContactForm(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    org: Optional[str] = None
    service: str
    budget: Optional[str] = None
    message: str
    lang: Optional[str] = "fr"

class InvoiceItem(BaseModel):
    description: str
    quantity: float
    unit_price: float

class Invoice(BaseModel):
    client_name: str
    client_email: EmailStr
    client_org: Optional[str] = None
    items: list[InvoiceItem]
    currency: str = "FCFA"
    notes: Optional[str] = None

# ---- ROUTES ----

@app.get("/")
def root():
    return {
        "name": "DataLab atirbi API",
        "version": "1.0.0",
        "status": "active",
        "docs": "/docs"
    }

@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


# ---- CONTACT ----
@app.post("/api/contact")
async def receive_contact(form: ContactForm):
    """Recevoir une demande de contact et notifier via Power Automate"""
    try:
        # Préparer les données
        data = {
            "name": form.name,
            "email": form.email,
            "phone": form.phone,
            "org": form.org,
            "service": form.service,
            "budget": form.budget,
            "message": form.message,
            "lang": form.lang,
            "timestamp": datetime.now().isoformat(),
            "source": "datalab.atirbi.com"
        }

        # Envoyer à Power Automate (webhook)
        power_automate_url = os.getenv("POWER_AUTOMATE_WEBHOOK", "")
        if power_automate_url:
            async with httpx.AsyncClient() as client:
                await client.post(power_automate_url, json=data, timeout=10)

        # Générer réponse automatique avec Claude AI
        response_message = await generate_ai_response(form)

        return JSONResponse({
            "success": True,
            "message": "Demande reçue avec succès",
            "auto_response": response_message,
            "ref": f"REQ-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def generate_ai_response(form: ContactForm) -> str:
    """Générer une réponse personnalisée via Claude API"""
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        if form.lang == "fr":
            return f"Merci {form.name} ! Nous avons bien reçu votre demande concernant '{form.service}'. Notre équipe vous contactera sous 24h."
        return f"Thank you {form.name}! We received your request about '{form.service}'. Our team will contact you within 24h."

    prompt = f"""Tu es l'assistant de DataLab atirbi, une startup camerounaise spécialisée en analyse de données, GIS et digital.

Génère une réponse email courte et professionnelle (3-4 phrases max) en {form.lang} pour:
- Nom: {form.name}
- Organisation: {form.org or 'Non précisée'}
- Service demandé: {form.service}
- Message: {form.message}

La réponse doit être chaleureuse, confirmer la réception, et mentionner qu'on reviendra sous 24h avec une proposition."""

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": "claude-sonnet-4-5",
                    "max_tokens": 300,
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=15
            )
            data = response.json()
            return data["content"][0]["text"]
    except:
        return f"Merci {form.name} ! Votre demande a bien été reçue. Nous vous répondrons sous 24h."


# ---- ANALYSE FICHIER ----
@app.post("/api/analyse")
async def analyse_fichier(fichier: UploadFile = File(...)):
    """Analyser un fichier CSV ou Excel uploadé par un client"""
    try:
        contenu = await fichier.read()
        nom = fichier.filename

        if nom.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contenu))
        elif nom.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(contenu))
        else:
            raise HTTPException(status_code=400, detail="Format non supporté. Utiliser CSV ou Excel.")

        # Analyse de base
        resultats = {
            "fichier": nom,
            "lignes": len(df),
            "colonnes": len(df.columns),
            "noms_colonnes": list(df.columns),
            "types_colonnes": {col: str(dtype) for col, dtype in df.dtypes.items()},
            "valeurs_manquantes": df.isnull().sum().to_dict(),
            "doublons": int(df.duplicated().sum()),
            "resume_numerique": df.describe().to_dict() if len(df.select_dtypes(include='number').columns) > 0 else {},
            "apercu": df.head(5).to_dict(orient='records'),
            "timestamp": datetime.now().isoformat()
        }

        return JSONResponse(content=resultats)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'analyse: {str(e)}")


# ---- FACTURATION ----
@app.post("/api/invoice/calculate")
def calculate_invoice(invoice: Invoice):
    """Calculer le montant d'une facture avec taxes Cameroun (AIR 5.5%)"""
    items_calc = []
    subtotal = 0

    for item in invoice.items:
        total = item.quantity * item.unit_price
        subtotal += total
        items_calc.append({
            "description": item.description,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "total": total,
            "formatted": f"{total:,.0f} {invoice.currency}"
        })

    # Taxes Cameroun RSI — AIR 5.5%
    air_rate = 0.055
    air_amount = subtotal * air_rate
    total_ttc = subtotal + air_amount

    return {
        "client": {
            "name": invoice.client_name,
            "email": invoice.client_email,
            "org": invoice.client_org
        },
        "items": items_calc,
        "totals": {
            "subtotal": subtotal,
            "air_rate": f"{air_rate * 100}%",
            "air_amount": air_amount,
            "total_ttc": total_ttc,
            "currency": invoice.currency,
            "formatted": {
                "subtotal": f"{subtotal:,.0f} {invoice.currency}",
                "air": f"{air_amount:,.0f} {invoice.currency}",
                "total": f"{total_ttc:,.0f} {invoice.currency}"
            }
        },
        "invoice_ref": f"FACT-{datetime.now().strftime('%Y%m%d%H%M')}",
        "date": datetime.now().strftime("%d/%m/%Y"),
        "notes": invoice.notes
    }


# ---- LANCER L'API ----
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
