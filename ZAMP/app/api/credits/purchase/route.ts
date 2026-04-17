import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const PURCHASES_DIR = '. purchases';

export async function POST(req: Request) {
  try {
    const { amount, price, package_label, customer_email } = await req.json();

    if (!amount || !price) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate a purchase token
    const purchase_token = `zamp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Store pending purchase
    const purchase = {
      token: purchase_token,
      amount,
      price,
      package_label: package_label || 'Unknown',
      customer_email: customer_email || null,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      completed_at: null
    };

    // Ensure purchases directory exists
    if (!existsSync(PURCHASES_DIR)) {
      await mkdir(PURCHASES_DIR, { recursive: true });
    }

    // Write purchase record
    const purchaseFile = `${PURCHASES_DIR}/${purchase_token}.json`;
    await writeFile(purchaseFile, JSON.stringify(purchase, null, 2));

    // Return purchase details with crypto addresses
    return NextResponse.json({
      success: true,
      purchase_token,
      amount,
      price_usd: price,
      package_label: package_label || 'Credit Package',
      crypto_addresses: {
        BTC: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        USDT_TRC20: 'TJb1USrL2kP8yCEM3XU3JK1y9Km9s9X4G5',
        XRP: 'r4GsC1Dq3LQJ5N2v2xK7p8tQ9f8h3J6kL',
        XRP_TAG: '123456',
        POLYGON: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
      },
      instructions: 'Send exact payment to the address above. Email zamp@cann.on.ai with your purchase token and payment proof (screenshot/transaction hash). Credits will be activated within 24 hours.',
      email: 'zamp@cann.on.ai'
    });
  } catch (error) {
    console.error('Purchase error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}