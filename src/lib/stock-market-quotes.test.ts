import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchKqStockQuotes, parseYahooStockQuotes, stockPriceDecimal } from "./stock-market-quotes";
const now=Date.parse("2026-09-23T15:00:00Z"), seconds=now/1000;
const meta=(symbol:string,overrides:Record<string,unknown>={})=>({symbol,currency:symbol==="^FCHI"?"EUR":"USD",instrumentType:symbol.startsWith("^")?"INDEX":symbol==="EURUSD=X"?"CURRENCY":"EQUITY",regularMarketPrice:symbol==="EURUSD=X"?1.2:120,regularMarketTime:seconds-60,chartPreviousClose:100,currentTradingPeriod:{regular:{start:seconds-3600,end:seconds+3600}},...overrides});
const envelope=(...metas:Record<string,unknown>[])=>({spark:{error:null,result:metas.map(m=>({symbol:m.symbol,response:[{meta:m}]}))}});
const fetchMock=vi.fn();
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(now);vi.stubGlobal("fetch",fetchMock);});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.clearAllMocks();});
describe("Yahoo public stock quote adapter",()=>{
 it("reads reordered batch symbols and preserves native prices plus USD-per-EUR for SQL",()=>{
  const quotes=parseYahooStockQuotes(envelope(meta("EURUSD=X"),meta("AAPL"),meta("^FCHI")),["^FCHI","AAPL"],now);
  expect(quotes).toHaveLength(2);expect(quotes[0]).toMatchObject({id:"^FCHI",currency:"EUR",fxRate:"1",fxQuotedAt:null});
  expect(quotes[1]).toMatchObject({id:"AAPL",currency:"USD",priceNative:"120",fxRate:"1.2",quotedAt:new Date(now-60000).toISOString(),marketState:"open"});expect(quotes[1]).not.toHaveProperty("priceEur");
 });
 it("refreshes a bounded visible page and FX in one no-store call without accepting arbitrary symbols",async()=>{
  fetchMock.mockResolvedValue({ok:true,json:async()=>envelope(meta("AAPL"),meta("EURUSD=X"))});await fetchKqStockQuotes(["AAPL","AAPL"]);
  expect(fetchMock).toHaveBeenCalledTimes(1);const [url,options]=fetchMock.mock.calls[0];expect(url.hostname).toBe("query1.finance.yahoo.com");expect(url.searchParams.get("symbols")).toBe("AAPL,EURUSD=X");expect(options.cache).toBe("no-store");expect(options.redirect).toBe("error");
  await expect(fetchKqStockQuotes(["http://private.internal"])).rejects.toThrow("invalid symbols");expect(fetchMock).toHaveBeenCalledTimes(1);
 });
 it("keeps usable EUR instruments when USD FX or one other quote is missing",()=>{
  expect(parseYahooStockQuotes(envelope(meta("^FCHI"),meta("AAPL")),["^FCHI","AAPL"],now).map(q=>q.id)).toEqual(["^FCHI"]);
  expect(parseYahooStockQuotes(envelope(meta("^FCHI"),meta("AAPL",{regularMarketTime:seconds-2800}),meta("EURUSD=X")),["^FCHI","AAPL"],now).map(q=>q.id)).toEqual(["^FCHI"]);
 });
 it("rejects an old FX quote during an open US session while accepting weekend closing data",()=>{
  expect(parseYahooStockQuotes(envelope(meta("AAPL"),meta("EURUSD=X",{instrumentType:"EQUITY"})),["AAPL"],now)).toEqual([]);
  const fx=meta("EURUSD=X",{regularMarketTime:seconds-72*3600});
  expect(parseYahooStockQuotes(envelope(meta("AAPL"),fx),["AAPL"],now)).toEqual([]);
  const closed=meta("AAPL",{regularMarketTime:seconds-72*3600,currentTradingPeriod:{regular:{start:seconds-76*3600,end:seconds-72*3600}}});
  expect(parseYahooStockQuotes(envelope(closed,fx),["AAPL"],now)[0]).toMatchObject({marketState:"closed",fxQuotedAt:new Date(now-72*3600_000).toISOString()});
 });
 it("never rewrites an old provider timestamp as fresh and handles closed sessions",()=>{
  const closed=meta("^FCHI",{regularMarketTime:seconds-72*3600,currentTradingPeriod:{regular:{start:seconds-76*3600,end:seconds-72*3600}}});
  expect(parseYahooStockQuotes(envelope(closed),["^FCHI"],now)[0]).toMatchObject({marketState:"closed",quotedAt:new Date(now-72*3600_000).toISOString()});
  expect(parseYahooStockQuotes(envelope({...closed,regularMarketTime:seconds-97*3600}),["^FCHI"],now)).toEqual([]);
 });
 it.each([{currency:"USD"},{instrumentType:"EQUITY"},{regularMarketPrice:0},{regularMarketTime:seconds+61},{currentTradingPeriod:{}}])("drops identity, price and session mismatches: %j",invalid=>{
  expect(parseYahooStockQuotes(envelope(meta("^FCHI",invalid)),["^FCHI"],now)).toEqual([]);
 });
 it("rejects unexpected or duplicated response symbols and provider error envelopes",()=>{
  expect(()=>parseYahooStockQuotes(envelope(meta("MSFT")),["AAPL"],now)).toThrow("unexpected symbol");
  expect(()=>parseYahooStockQuotes(envelope(meta("^FCHI"),meta("^FCHI")),["^FCHI"],now)).toThrow();
  expect(()=>parseYahooStockQuotes({spark:{error:{code:"Bad Request"},result:[]}},["^FCHI"],now)).toThrow();
 });
 it("keeps HTTP failures diagnosable without exposing response bodies",async()=>{
  fetchMock.mockResolvedValue({ok:false,status:429});await expect(fetchKqStockQuotes(["^FCHI"])).rejects.toThrow("HTTP 429");
 });
 it("expands numeric notation but rejects prices outside SQL precision",()=>{
  expect(stockPriceDecimal(1e-8)).toBe("0.00000001");expect(stockPriceDecimal(123.45)).toBe("123.45");for(const bad of [0,-1,Infinity,NaN,1e19,1e-19,"10"])expect(()=>stockPriceDecimal(bad)).toThrow();
 });
});
