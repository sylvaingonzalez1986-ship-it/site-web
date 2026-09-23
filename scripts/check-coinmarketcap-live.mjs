// Read-only live contract smoke. Uses the same adapter as production; never touches game balances.
// CMC_API_KEY is optional. No env files are loaded and no credentials are printed.
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
const vite = await createServer({configFile:false,envDir:false,resolve:{alias:{'@':path.resolve('src'),'server-only':path.resolve('src/test/server-only.ts')}},server:{middlewareMode:true,watch:null}});
try {
 const {fetchCoinMarketCapTop100,fetchCoinMarketCapQuotes}=await vite.ssrLoadModule('/src/lib/coinmarketcap.ts');
 const top=await fetchCoinMarketCapTop100();assert.equal(top.length,100);assert.equal(new Set(top.map(x=>x.id)).size,100);assert(top.every(x=>x.inTop100));
 const quotes=await fetchCoinMarketCapQuotes([top[0].id]);assert.equal(quotes[0]?.id,top[0].id);assert.equal(quotes[0]?.inTop100,false);
 console.log(JSON.stringify({provider:'CoinMarketCap',currency:'EUR',assets:top.length,firstAssetId:top[0].id,firstSymbol:top[0].symbol,quotedAt:top[0].quotedAt,heldByIdQuoteVerified:true,mode:process.env.CMC_API_KEY?.trim()?'keyed':'official-public'},null,2));
} catch(error) {console.error('Live CMC contract unavailable:',error instanceof Error?error.message:'unknown');process.exitCode=1;}
finally {await vite.close();}
