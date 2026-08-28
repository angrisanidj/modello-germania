#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

PARSER_VERSION = 1
WINDOW_DAYS = 14
STALE_AFTER_HOURS = 36
REFRESH_COMMIT_HOURS = 24
MIN_ELIGIBLE_INSTITUTES = 5
MAX_SOURCE_LAG_DAYS = 45
USER_AGENT = "modello-germania-input-integrity/1.0 (+https://github.com/angrisanidj/modello-germania)"
MAIN_URL = "https://www.wahlrecht.de/umfragen/"
OTHER_URL = "https://www.wahlrecht.de/umfragen/weitere-umfragen.htm"
SOURCE_PAGES = [MAIN_URL, OTHER_URL]
REQUIRED_PRIMARY = [
    "Allensbach",
    "Verian",
    "Forsa",
    "Forschungsgruppe Wahlen",
    "GMS",
    "Infratest dimap",
    "INSA",
    "YouGov",
]
ORDER = {name: i for i, name in enumerate(REQUIRED_PRIMARY + ["pollytix"])}

EXIT_SOURCE_UNAVAILABLE = 20
EXIT_PARSER_FAILURE = 30
EXIT_MARKUP_DRIFT = 31

class SourceUnavailableError(RuntimeError):
    pass

class ParserSanityError(RuntimeError):
    pass

class MarkupDriftError(RuntimeError):
    pass

def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ")).strip()

def _fold(value: str) -> str:
    s = _clean(value).lower()
    repl = {
        "ä":"a","ö":"o","ü":"u","ß":"ss",
        "’":"'","‘":"'","´":"'","`":"'",
    }
    for a,b in repl.items():
        s=s.replace(a,b)
    return re.sub(r"[^a-z0-9]+", "", s)

def canonical_primary(value: str) -> str | None:
    k = _fold(value)
    aliases = {
        "allensbach":"Allensbach",
        "ifdallensbach":"Allensbach",
        "verian":"Verian",
        "kantarpublicverian":"Verian",
        "forsa":"Forsa",
        "forschgrwahlen":"Forschungsgruppe Wahlen",
        "forschungsgruppewahlen":"Forschungsgruppe Wahlen",
        "forschungsgruppewahlenev":"Forschungsgruppe Wahlen",
        "gms":"GMS",
        "infratestdimap":"Infratest dimap",
        "arddeutschlandtrendinfratestdimap":"Infratest dimap",
        "insa":"INSA",
        "yougov":"YouGov",
    }
    return aliases.get(k)

def canonical_other(value: str) -> str:
    text = _clean(value)
    if _fold(text) == "pollytix":
        return "pollytix"
    return text

def parse_date_text(value: str) -> str | None:
    m = re.search(r"\b(\d{2})\.(\d{2})\.(\d{4})\b", _clean(value))
    if not m:
        return None
    d,mn,y = map(int,m.groups())
    try:
        return date(y,mn,d).isoformat()
    except ValueError:
        return None

class TableCollector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables: list[list[list[str]]] = []
        self._table_depth = 0
        self._rows: list[list[str]] | None = None
        self._row: list[str] | None = None
        self._cell_parts: list[str] | None = None
        self._cell_span = 1

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "table":
            self._table_depth += 1
            if self._table_depth == 1:
                self._rows = []
        elif self._table_depth == 1 and tag == "tr":
            self._row = []
        elif self._table_depth == 1 and tag in ("td","th") and self._row is not None:
            self._cell_parts = []
            ad = dict(attrs)
            try:
                self._cell_span = max(1,int(ad.get("colspan","1")))
            except ValueError:
                self._cell_span = 1
        elif self._table_depth == 1 and tag == "br" and self._cell_parts is not None:
            self._cell_parts.append(" ")

    def handle_data(self, data):
        if self._cell_parts is not None:
            self._cell_parts.append(data)

    def handle_endtag(self, tag):
        tag=tag.lower()
        if self._table_depth == 1 and tag in ("td","th") and self._cell_parts is not None and self._row is not None:
            text=_clean("".join(self._cell_parts))
            self._row.extend([text]*self._cell_span)
            self._cell_parts=None
            self._cell_span=1
        elif self._table_depth == 1 and tag == "tr" and self._row is not None and self._rows is not None:
            if any(_clean(x) for x in self._row):
                self._rows.append(self._row)
            self._row=None
        elif tag == "table" and self._table_depth:
            if self._table_depth == 1 and self._rows is not None:
                self.tables.append(self._rows)
                self._rows=None
            self._table_depth -= 1

def extract_tables(html: str) -> list[list[list[str]]]:
    p=TableCollector()
    p.feed(html)
    p.close()
    return p.tables

def _row_first(row: list[str]) -> str:
    for c in row:
        if _clean(c):
            return _clean(c)
    return ""

def parse_main_page(html: str):
    tables=extract_tables(html)
    candidate=None
    inst_row=None
    date_row=None
    for table in tables:
        ir=dr=None
        for row in table:
            first=_fold(_row_first(row))
            if first == "institut" and sum(canonical_primary(c) is not None for c in row) >= 5:
                ir=row
            if first.startswith("veroffentl"):
                dr=row
        if ir and dr:
            candidate=table;inst_row=ir;date_row=dr;break
    if candidate is None or inst_row is None or date_row is None:
        raise ParserSanityError("main page: institute/publication rows not found")
    if abs(len(inst_row)-len(date_row)) > 2:
        raise ParserSanityError(f"main page: header/date column mismatch {len(inst_row)} vs {len(date_row)}")
    observations=[]
    maxcols=max(len(inst_row),len(date_row))
    for i in range(maxcols):
        name=canonical_primary(inst_row[i] if i<len(inst_row) else "")
        if not name:
            continue
        d=parse_date_text(date_row[i] if i<len(date_row) else "")
        if not d:
            raise ParserSanityError(f"main page: missing publication date for {name}")
        observations.append({"institute":name,"date":d})
    profile={
        "headerColumns":len(inst_row),
        "dateColumns":len(date_row),
        "primaryInstitutes":sorted({x["institute"] for x in observations}),
        "tableRows":len(candidate),
    }
    return observations,profile

def parse_other_page(html: str):
    tables=extract_tables(html)
    candidate=None
    header=None
    for table in tables:
        for row in table:
            folds={_fold(c) for c in row}
            if {"institut","auftraggeber","befragte","datum"}.issubset(folds) and "afd" in folds:
                candidate=table;header=row;break
        if candidate:
            break
    if candidate is None or header is None:
        raise ParserSanityError("other page: expected poll table header not found")
    observations=[]
    for row in candidate:
        if row is header:
            continue
        first=_row_first(row)
        if not first or _fold(first) in {"institut"} or "bundestagswahl" in _fold(first):
            continue
        pub=None
        for cell in row:
            d=parse_date_text(cell)
            if d:
                pub=d
                break
        if not pub:
            continue
        institute=canonical_other(row[0] if row else first)
        if not institute:
            continue
        observations.append({"institute":institute,"date":pub})
    profile={
        "headerColumns":len(header),
        "pollRows":len(observations),
        "institutes":sorted({x["institute"] for x in observations}),
        "tableRows":len(candidate),
    }
    return observations,profile

def _day(s: str) -> date:
    return date.fromisoformat(s)

def build_eligible(observations: Iterable[dict], window_days: int=WINDOW_DAYS):
    observations=list(observations)
    if not observations:
        raise ParserSanityError("no canonical observations parsed")
    as_of=max(_day(x["date"]) for x in observations)
    start=as_of-timedelta(days=max(1,int(window_days))-1)
    latest={}
    for row in observations:
        d=_day(row["date"])
        if d < start or d > as_of:
            continue
        k=_fold(row["institute"])
        prev=latest.get(k)
        if prev is None or _day(prev["date"]) < d:
            latest[k]={"institute":row["institute"],"date":row["date"]}
    eligible=list(latest.values())
    eligible.sort(key=lambda x:(ORDER.get(x["institute"],999), _fold(x["institute"])))
    return as_of.isoformat(), eligible

def validate_snapshot(main_obs, other_obs, main_profile, other_profile, now: datetime|None=None):
    now=now or datetime.now(timezone.utc)
    today=now.date()
    main_names={x["institute"] for x in main_obs}
    missing=[x for x in REQUIRED_PRIMARY if x not in main_names]
    if missing:
        raise ParserSanityError("main page missing canonical institutes: "+", ".join(missing))
    for row in main_obs:
        d=_day(row["date"])
        if d < date(2025,2,24) or d > today+timedelta(days=1):
            raise ParserSanityError(f"implausible primary date: {row['institute']} {row['date']}")
    if not any(_fold(x["institute"])=="pollytix" for x in other_obs):
        raise ParserSanityError("other page: historical/current pollytix row not found")
    as_of, eligible=build_eligible(list(main_obs)+list(other_obs),WINDOW_DAYS)
    as_of_day=_day(as_of)
    lag=(today-as_of_day).days
    if lag < -1 or lag > MAX_SOURCE_LAG_DAYS:
        raise ParserSanityError(f"latest canonical poll date implausible: {as_of} (lag {lag} days)")
    if len(eligible) < MIN_ELIGIBLE_INSTITUTES:
        raise ParserSanityError(f"eligible institute count too low: {len(eligible)} < {MIN_ELIGIBLE_INSTITUTES}")
    return {
        "asOfDate":as_of,
        "eligible":eligible,
        "mainProfile":main_profile,
        "otherProfile":other_profile,
    }

def _jaccard(a,b):
    a=set(a);b=set(b)
    return 1.0 if not a and not b else len(a&b)/max(1,len(a|b))

def compare_profiles(live: dict, baseline: dict):
    issues=[]
    lm, bm=live["main"], baseline["main"]
    lo, bo=live["other"], baseline["other"]
    if abs(int(lm["headerColumns"])-int(bm["headerColumns"])) > 2:
        issues.append(f"main header column drift {bm['headerColumns']} -> {lm['headerColumns']}")
    if abs(int(lm["dateColumns"])-int(bm["dateColumns"])) > 2:
        issues.append(f"main date column drift {bm['dateColumns']} -> {lm['dateColumns']}")
    if set(lm["primaryInstitutes"]) != set(REQUIRED_PRIMARY):
        issues.append("main primary institute set changed")
    if abs(int(lo["headerColumns"])-int(bo["headerColumns"])) > 2:
        issues.append(f"other header column drift {bo['headerColumns']} -> {lo['headerColumns']}")
    min_rows=max(1,int(bo["pollRows"])-3)
    if int(lo["pollRows"]) < min_rows:
        issues.append(f"other parsed poll rows dropped {bo['pollRows']} -> {lo['pollRows']}")
    if _jaccard(lo.get("institutes",[]),bo.get("institutes",[])) < 0.70:
        issues.append("other institute-set Jaccard below 0.70")
    if issues:
        raise MarkupDriftError("; ".join(issues))
    return True

def classify_http_failure(status: int) -> str:
    if status in (429,503):
        return "source-unavailable"
    return "source-unavailable"

def fetch_url(url: str, timeout: int=25) -> str:
    req=urllib.request.Request(url,headers={
        "User-Agent":USER_AGENT,
        "Accept":"text/html,application/xhtml+xml",
        "Accept-Language":"de-DE,de;q=0.9,en;q=0.5",
    })
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r:
            status=getattr(r,"status",200)
            if status in (429,503):
                raise SourceUnavailableError(f"HTTP {status} from {url}")
            raw=r.read()
            ctype=(r.headers.get_content_charset() if getattr(r,"headers",None) else None) or "utf-8"
            try:
                return raw.decode(ctype)
            except UnicodeDecodeError:
                return raw.decode("latin-1")
    except urllib.error.HTTPError as e:
        raise SourceUnavailableError(f"HTTP {e.code} from {url}") from e
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise SourceUnavailableError(f"network/source unavailable for {url}: {e}") from e

def snapshot_profile(main_html: str, other_html: str):
    main_obs,mp=parse_main_page(main_html)
    other_obs,op=parse_other_page(other_html)
    snap=validate_snapshot(main_obs,other_obs,mp,op)
    return snap,{"parserVersion":PARSER_VERSION,"main":mp,"other":op}

def latest_fixture_dir(root: Path) -> Path:
    base=root/"tests/fixtures/wahlrecht"
    candidates=[p for p in base.iterdir() if p.is_dir() and re.fullmatch(r"\d{4}-\d{2}-\d{2}",p.name)]
    if not candidates:
        raise ParserSanityError("no dated Wahlrecht fixture baseline found")
    return sorted(candidates,key=lambda p:p.name)[-1]

def load_baseline_profile(root: Path):
    d=latest_fixture_dir(root)
    p=d/"profile.json"
    if not p.exists():
        raise ParserSanityError(f"fixture profile missing: {p}")
    return d.name,json.loads(p.read_text(encoding="utf-8"))

def build_manifest(snapshot: dict, verified_at: datetime|None=None, fixture_baseline: str|None=None):
    verified_at=verified_at or datetime.now(timezone.utc)
    if verified_at.tzinfo is None:
        verified_at=verified_at.replace(tzinfo=timezone.utc)
    verified_at=verified_at.astimezone(timezone.utc)
    return {
        "schemaVersion":1,
        "source":"Wahlrecht.de",
        "status":"verified",
        "mode":"automated",
        "verifiedAt":verified_at.isoformat().replace("+00:00","Z"),
        "asOfDate":snapshot["asOfDate"],
        "windowDays":WINDOW_DAYS,
        "staleAfterHours":STALE_AFTER_HOURS,
        "parserVersion":PARSER_VERSION,
        "fixtureBaseline":fixture_baseline,
        "sourcePages":SOURCE_PAGES,
        "eligible":snapshot["eligible"],
        "note":"Verifica upstream automatizzata. Verde atteso solo con freshness valida e coerenza fonte → dataset → motore; ogni giallo dopo il primo run automatico è un'anomalia da verificare.",
    }

def _parse_iso(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z","+00:00"))

def _semantic_manifest(m: dict):
    return {
        "mode":m.get("mode"),
        "status":m.get("status"),
        "asOfDate":m.get("asOfDate"),
        "windowDays":m.get("windowDays"),
        "staleAfterHours":m.get("staleAfterHours"),
        "parserVersion":m.get("parserVersion"),
        "fixtureBaseline":m.get("fixtureBaseline"),
        "sourcePages":m.get("sourcePages"),
        "eligible":m.get("eligible"),
    }

def should_refresh_manifest(current: dict, candidate: dict, now: datetime|None=None, max_age_hours: float=REFRESH_COMMIT_HOURS):
    now=now or datetime.now(timezone.utc)
    if current.get("mode")!="automated" or current.get("status")!="verified":
        return True
    if _semantic_manifest(current)!=_semantic_manifest(candidate):
        return True
    try:
        age=(now.astimezone(timezone.utc)-_parse_iso(current["verifiedAt"]).astimezone(timezone.utc)).total_seconds()/3600
    except Exception:
        return True
    return age >= float(max_age_hours)

def write_json(path: Path, value: dict):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

def cmd_refresh_fixtures(args):
    root=Path(args.root).resolve()
    main=fetch_url(MAIN_URL);other=fetch_url(OTHER_URL)
    snap,profile=snapshot_profile(main,other)
    stamp=args.date or datetime.now(timezone.utc).date().isoformat()
    d=root/"tests/fixtures/wahlrecht"/stamp
    d.mkdir(parents=True,exist_ok=True)
    (d/"main.html").write_text(main,encoding="utf-8")
    (d/"weitere-umfragen.html").write_text(other,encoding="utf-8")
    profile.update({
        "capturedAt":datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),
        "sourcePages":SOURCE_PAGES,
        "sha256":{
            "main.html":hashlib.sha256(main.encode("utf-8")).hexdigest(),
            "weitere-umfragen.html":hashlib.sha256(other.encode("utf-8")).hexdigest(),
        },
        "asOfDate":snap["asOfDate"],
        "eligible":snap["eligible"],
    })
    write_json(d/"profile.json",profile)
    print(f"Fixture Wahlrecht salvate in {d}")
    print(f"asOfDate={snap['asOfDate']} eligible={len(snap['eligible'])}")

def cmd_live(args):
    root=Path(args.root).resolve()
    baseline_name,baseline=load_baseline_profile(root)
    main=fetch_url(MAIN_URL);other=fetch_url(OTHER_URL)
    snap,live_profile=snapshot_profile(main,other)
    compare_profiles(live_profile,baseline)
    manifest=build_manifest(snap,fixture_baseline=baseline_name)
    write_json(Path(args.candidate),manifest)
    if args.report:
        write_json(Path(args.report),{
            "state":"verified",
            "category":"ok",
            "fixtureBaseline":baseline_name,
            "asOfDate":manifest["asOfDate"],
            "eligibleCount":len(manifest["eligible"]),
            "eligible":manifest["eligible"],
        })
    print(f"Guard A live OK: baseline={baseline_name} asOfDate={manifest['asOfDate']} eligible={len(manifest['eligible'])}")

def cmd_apply_candidate(args):
    current_path=Path(args.current)
    candidate_path=Path(args.candidate)
    current=json.loads(current_path.read_text(encoding="utf-8")) if current_path.exists() else {}
    candidate=json.loads(candidate_path.read_text(encoding="utf-8"))
    now=datetime.now(timezone.utc)
    if should_refresh_manifest(current,candidate,now,args.max_age_hours):
        write_json(current_path,candidate)
        print("source-verification.json aggiornato")
    else:
        print("source-verification.json invariato: certificazione recente e lista eleggibile invariata")

def build_parser():
    p=argparse.ArgumentParser(description="Guard A automatica per Wahlrecht.de")
    sub=p.add_subparsers(dest="cmd",required=True)
    q=sub.add_parser("refresh-fixtures")
    q.add_argument("--root",default=".")
    q.add_argument("--date")
    q.set_defaults(func=cmd_refresh_fixtures)
    q=sub.add_parser("live")
    q.add_argument("--root",default=".")
    q.add_argument("--candidate",required=True)
    q.add_argument("--report")
    q.set_defaults(func=cmd_live)
    q=sub.add_parser("apply-candidate")
    q.add_argument("--current",default="data/source-verification.json")
    q.add_argument("--candidate",required=True)
    q.add_argument("--max-age-hours",type=float,default=REFRESH_COMMIT_HOURS)
    q.set_defaults(func=cmd_apply_candidate)
    return p

def main(argv=None):
    args=build_parser().parse_args(argv)
    try:
        args.func(args)
        return 0
    except SourceUnavailableError as e:
        print(f"GUARD_A_SOURCE_UNAVAILABLE: {e}",file=sys.stderr)
        return EXIT_SOURCE_UNAVAILABLE
    except MarkupDriftError as e:
        print(f"GUARD_A_MARKUP_DRIFT: {e}",file=sys.stderr)
        return EXIT_MARKUP_DRIFT
    except ParserSanityError as e:
        print(f"GUARD_A_PARSER_FAILURE: {e}",file=sys.stderr)
        return EXIT_PARSER_FAILURE

if __name__=="__main__":
    raise SystemExit(main())
