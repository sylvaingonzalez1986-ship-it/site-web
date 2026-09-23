import { describe, expect, it } from "vitest";
import { canTradeKqStockAsset, getKqStockInstrument, isKqStockAsset, isKqStockSnapshot, KQ_STOCK_INSTRUMENTS, KQ_STOCK_MAX_BATCH, parseKqStockAction, parseKqStockAssetIds, parseKqStockEuros, type KqStockAsset } from "./kanab-quest-stocks";
const now=Date.parse("2026-09-23T15:00:00Z"), iso=(ms:number)=>new Date(ms).toISOString();
export const stockFixture=(id="AAPL"):KqStockAsset=>({...getKqStockInstrument(id)!,priceNative:"120",priceEur:"100",changePercent:2,quotedAt:iso(now-60_000),refreshedAt:iso(now),marketState:"open",fxRate:"1.2",fxQuotedAt:iso(now-60_000)});
describe("virtual stock market contracts",()=>{
 it("contains both indices and the complete sourced equity universes",()=>{
  expect(getKqStockInstrument("^FCHI")?.kind).toBe("index");expect(getKqStockInstrument("^GSPC")?.kind).toBe("index");
  expect(KQ_STOCK_INSTRUMENTS.filter(a=>a.kind==="stock"&&a.markets.includes("cac40"))).toHaveLength(40);
  expect(KQ_STOCK_INSTRUMENTS.filter(a=>a.kind==="stock"&&a.markets.includes("sp500")).length).toBeGreaterThanOrEqual(500);
  expect(new Set(KQ_STOCK_INSTRUMENTS.map(a=>a.id)).size).toBe(KQ_STOCK_INSTRUMENTS.length);
  expect(KQ_STOCK_INSTRUMENTS.every(a=>a.id.length<=24&&["EUR","USD"].includes(a.currency))).toBe(true);
 });
 it("uses an allowlisted bounded quote selection",()=>{
  expect(parseKqStockAssetIds(null)).toEqual(["^FCHI","^GSPC"]);expect(parseKqStockAssetIds("")).toEqual([]);expect(parseKqStockAssetIds("AAPL,AAPL")).toEqual(["AAPL"]);
  expect(()=>parseKqStockAssetIds("https://attacker.test")).toThrow();expect(()=>parseKqStockAssetIds(KQ_STOCK_INSTRUMENTS.slice(0,KQ_STOCK_MAX_BATCH+1).map(a=>a.id).join(","))).toThrow();
 });
 it("strips client ownership, price and FX from transactions",()=>{
  expect(parseKqStockAction({action:"preview",side:"buy",assetId:"AAPL",amountCents:10000,priceEur:"1",fxRate:"1",userId:"victim"})).toEqual({action:"preview",side:"buy",assetId:"AAPL",amountCents:10000});
  for(const amountCents of [0,99,100_000_001,1.5,"100"] )expect(()=>parseKqStockAction({action:"preview",side:"buy",assetId:"AAPL",amountCents})).toThrow();
  expect(()=>parseKqStockAction({action:"preview",side:"sell",assetId:"AAPL",quantity:"1e5"})).toThrow();
 });
 it("accepts fresh open quotes and a recently checked weekend close, but refuses stale source/FX/cache",()=>{
  const asset=stockFixture();expect(canTradeKqStockAsset(asset,now)).toBe(true);
  expect(canTradeKqStockAsset({...asset,quotedAt:iso(now-46*60_000)},now)).toBe(false);
  expect(canTradeKqStockAsset({...asset,marketState:"closed",quotedAt:iso(now-72*3600_000),fxQuotedAt:iso(now-72*3600_000)},now)).toBe(true);
  expect(canTradeKqStockAsset({...asset,marketState:"closed",quotedAt:iso(now-97*3600_000)},now)).toBe(false);
  expect(canTradeKqStockAsset({...asset,fxQuotedAt:iso(now-97*3600_000)},now)).toBe(false);
  expect(canTradeKqStockAsset({...asset,fxQuotedAt:iso(now-46*60_000)},now)).toBe(false);
  expect(canTradeKqStockAsset({...asset,refreshedAt:iso(now-600_000)},now)).toBe(false);
  expect(canTradeKqStockAsset({...asset,quotedAt:iso(now+61_000)},now)).toBe(false);
 });
 it("retains unquoted catalogue rows and rejects mismatched identity or malformed snapshots",()=>{
  const asset=stockFixture();expect(isKqStockAsset(asset)).toBe(true);expect(isKqStockAsset({...asset,currency:"EUR"})).toBe(false);
  const empty={...getKqStockInstrument("^FCHI"),priceNative:null,priceEur:null,changePercent:null,quotedAt:null,refreshedAt:null,marketState:null,fxRate:null,fxQuotedAt:null};expect(isKqStockAsset(empty)).toBe(true);
  const snapshot={version:1,serverNow:iso(now),cashCents:100,assets:[asset,empty],positions:[],recentTrades:[]};expect(isKqStockSnapshot(snapshot)).toBe(true);
  expect(isKqStockSnapshot({...snapshot,assets:[asset,asset]})).toBe(false);expect(isKqStockSnapshot({...snapshot,cashCents:-1})).toBe(false);
 });
 it("parses euro cents exactly, including pasted French amounts",()=>{
  expect(parseKqStockEuros("100\u202f000,01")).toBe(10_000_001);expect(parseKqStockEuros("1000000")).toBe(100_000_000);
  for(const input of ["1000000,01","1e5","0,99","1.234","1 00 000"])expect(parseKqStockEuros(input)).toBeNull();
 });
});
