# Shophelper M0 inventory

The three existing tools are copied into `tools/` and keep their own saved data.

| Tool | Kept behavior | Storage key | Shared hook |
| --- | --- | --- | --- |
| Cartulator | Line tally, deals, languages, theme, export | `sdc_data`, `sdc_lang`, `sdc_theme` | Publishes payable total. Save a price reads existing lines. |
| Coupon Keeper | Coupons, gift cards, loyalty, on-device photo reading | `ck_state_v2` and its IndexedDB | No result published. Value and balance boxes can receive a money result. |
| Deal Checker | Price-per-unit comparison, samples, language, zoom | `dealComparatorState_v2` | Uses the shared pack-size factors. Publishes the best option's price. Save to Prices uses that option. |

Pack-size factors in `js/units.js` match Deal Checker's original table. Temperature and area exist only on the Units tool. Weight is not converted to volume.

New Shophelper data lives in `shophelper_v1` only. Backup and restore do not overwrite the three keys above.

Service workers inside the old tools are not registered. One root `sw.js` caches the combined app and does not delete the old tools' caches.
