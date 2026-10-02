# Documentation de conception — CopropHub

Cette arborescence contient, en version contrôlée, la documentation de conception produite pendant l'analyse, la conception et l'implémentation du projet (principe « pas d'anticipation » : rédigée à partir du réel, jamais par anticipation — voir en particulier [12-api/](12-api/) et [10-testing/evidence/](10-testing/evidence/), longtemps restés vides pour cette raison).

| Dossier | Contenu | Source |
|---|---|---|
| [01-project/](01-project/) | Périmètre, parties prenantes, glossaire, personas | Doc 2 |
| [02-requirements/](02-requirements/) | F-01→F-11, NF-01→NF-14, RM-01→RM-14, US-01→US-10 | Doc 2 |
| [03-project-management/](03-project-management/) | Méthode, jalons, backlog, suivi, [rétrospective](03-project-management/retrospective.md) | Doc 9 |
| [04-ux-ui/](04-ux-ui/) | Démarche zoning → wireframe → maquette → prototype, design system, écrans, accessibilité, responsive, [enchaînement des écrans](04-ux-ui/enchainement-ecrans.md) | Doc 4 |
| [05-merise/](05-merise/) | [dictionnaire de données](05-merise/dictionnaire-donnees.md), puis MCD, MLD (schémas en notation Merise, images et SVG dans `schemas/`), [MPD](05-merise/mpd.md) | Doc 3 § Merise |
| [06-uml/](06-uml/) | Cas d'utilisation (notation UML standard, image et SVG dans `schemas/`), classes, séquence (réelles, dérivées du code), états-transitions | Doc 3 § UML |
| [07-architecture/](07-architecture/) | Architecture 3 couches, mapping des dossiers, éco-conception | Doc 7 (ADR-001) |
| [08-security/](08-security/) | STRIDE, authN/authZ, checklist sécurité, alignement ANSSI, [correspondance OWASP Top 10](08-security/owasp-top10.md) | Doc 5 |
| [09-database/](09-database/) | Schéma Prisma, migrations, exemple SQL, sécurité du SGBD | découle du MPD |
| [10-testing/](10-testing/) | Pyramide de tests, traçabilité UT/IT, [jeu d'essai clôture d'AG](10-testing/jeu-essai-cloture-ag.md), [evidence/](10-testing/evidence/) (preuves réelles) | Doc 6 |
| [11-devops/](11-devops/) | CI/CD, Docker Compose, variables d'environnement | Doc 8 |
| [12-api/](12-api/) | Documentation des endpoints REST réellement implémentés | générée pendant l'implémentation |
| [13-decisions/](13-decisions/) | ADR-001 (3 couches), ADR-002 (authentification), ADR-003 (thème : stocker teinte et intensité), ADR-004 (tokens CSS, OKLCH natif), ADR-005 (choix de la pile) ; futurs ADR au fil des décisions structurantes | — |
| [14-technology-watch/](14-technology-watch/) | Veille technologique (en anglais, niveau B1 — référentiel RNCP 37873, compétences 2/3) | sources OWASP, Redis, express-rate-limit |

Ces fichiers Markdown sont la référence versionnée de la conception.
