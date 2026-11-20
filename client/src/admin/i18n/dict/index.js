// Loads every admin dictionary once. Pages share many words (a dashboard card uses a word defined with the Orders page), so a page must not
// depend on which other pages were opened first: AdminApp imports this file, and each page still imports its own file as well.
import './nav.js';
import './common.js';
import './shell.js';
import './sales.js';
import './catalog.js';
import './inventory.js';
import './accounts.js';
import './field.js';
import './seo.js';
import './system.js';
import './entries.js';
import './toplevel.js';
import './growthA.js';
import './growthB.js';
import './growthC.js';
import './growthD.js';
import './growthE.js';
