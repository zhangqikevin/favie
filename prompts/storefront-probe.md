Read-only probe. Do NOT log in, do NOT fetch the context, do NOT change anything.

1. `browser action:"session" op:"restart"` with loginLabel "favie-45aa0bb5" and egressCountry "US".
2. Navigate to https://www.doordash.com/store/41664625/ and wait for the menu to render (use act kind "wait" 3 seconds if needed). If a location / address modal appears, close it.
3. Take ONE `snapshot` with mode "full". Then answer, from that single snapshot, without further browsing:
   a. Did the page render the store menu? Store name shown?
   b. How many menu items and how many categories are visible in the snapshot?
   c. For the first 5 items: name, price, full description text (or "none"), and whether the item has a photo. If the snapshot exposes the photo's URL or filename, quote it verbatim; if it only exposes alt text, say so.
   d. Are sold-out / unavailable items marked in the snapshot? Quote the marker if you see one.
   e. Paste the raw snapshot lines for ONE item (5-10 lines) so I can see the exact structure.
4. Try ONE more thing: scroll to the bottom (act kind "scroll") and take a second snapshot; report whether more items appeared (lazy loading) and the new total.
5. Close the browser session. Reply in plain text. No favie-summary block needed.
