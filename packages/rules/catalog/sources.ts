import type { RuleSource } from "../src/types";

const gii = (path: string, label: string, norm: string): RuleSource => ({
  label,
  norm,
  url: `https://www.gesetze-im-internet.de/${path}`,
});

export const src = {
  bgb556: gii("bgb/__556.html", "Bürgerliches Gesetzbuch § 556", "§ 556 BGB"),
  bgb556a: gii("bgb/__556a.html", "Bürgerliches Gesetzbuch § 556a", "§ 556a BGB"),
  bgb556d: gii("bgb/__556d.html", "Bürgerliches Gesetzbuch § 556d", "§ 556d BGB"),
  bgb558: gii("bgb/__558.html", "Bürgerliches Gesetzbuch § 558", "§ 558 BGB"),
  weg23: gii("woeigg/__23.html", "Wohnungseigentumsgesetz § 23", "§ 23 WEG"),
  weg24: gii("woeigg/__24.html", "Wohnungseigentumsgesetz § 24", "§ 24 WEG"),
  weg45: gii("woeigg/__45.html", "Wohnungseigentumsgesetz § 45", "§ 45 WEG"),
  weg48: gii("woeigg/__48.html", "Wohnungseigentumsgesetz § 48", "§ 48 WEG"),
  heizkv5: gii("heizkostenv/__5.html", "Heizkostenverordnung § 5", "§ 5 HeizkostenV"),
  heizkv6a: gii("heizkostenv/__6a.html", "Heizkostenverordnung § 6a", "§ 6a HeizkostenV"),
  heizkv12: gii("heizkostenv/__12.html", "Heizkostenverordnung § 12", "§ 12 HeizkostenV"),
  co2: gii("co2kostaufg/", "Kohlendioxidkostenaufteilungsgesetz", "CO2KostAufG"),
  trinkwv31: gii("trinkwv_2023/__31.html", "Trinkwasserverordnung § 31", "§ 31 TrinkwV"),
  messev: gii("messev/", "Mess- und Eichverordnung, Anlage 7 (Eichfristen)", "MessEV Anlage 7"),
  ao147: gii("ao_1977/__147.html", "Abgabenordnung § 147", "§ 147 AO"),
  ustg14: gii("ustg_1980/__14.html", "Umsatzsteuergesetz § 14", "§ 14 UStG"),
  ustg27: gii("ustg_1980/__27.html", "Umsatzsteuergesetz § 27 (Übergangsvorschriften)", "§ 27 UStG"),
  estg35a: gii("estg/__35a.html", "Einkommensteuergesetz § 35a", "§ 35a EStG"),
  kiVo: {
    label: "Verordnung (EU) 2024/1689 (KI-Verordnung), Art. 50",
    norm: "Art. 50 KI-VO",
    url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
  },
  lbo: { label: "Landesbauordnungen der 16 Bundesländer (Rauchwarnmelderpflicht)", norm: "LBO" },
  mietrecht2: { label: "Gesetzentwurf Mietrecht II, BT-Drucksache 21/6807 (laut Projekt-Prompt in Ausschussberatung)", norm: "BT-Drs. 21/6807" },
  gmodg: {
    label: "Gebäudemodernisierungsgesetz (laut Projekt-Prompt, Quellen: DATEV magazin, miet-check) – nicht unabhängig geprüft",
    norm: "GModG",
  },
} satisfies Record<string, RuleSource>;
