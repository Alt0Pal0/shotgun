# Real-device field test checklist (PRD §14.2, prompt §27 Increment 7)

Automated tests cannot prove GPS, wake lock, realtime, or background behavior on real phones. Complete this matrix
before expanding the beta. Record device model, OS version, browser, installed-PWA yes/no, and outcome for each row.

## Setup

- [ ] Learner phone and adult phone are different devices, both signed in.
- [ ] Learner installed the PWA (Share → Add to Home Screen / Install app) and also tested in the plain browser.
- [ ] Location permission granted "While using"; phone's Driving Focus / Driving Mode enabled.

## iPhone (recent iOS Safari / installed PWA)

| #   | Scenario                                              | Expected                                                                               | Result |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- | ------ |
| 1   | 30-minute drive, screen on, phone in holder           | GPS good for ≥ 90% of minutes; adult live view updates every ≤ 10 s                    |        |
| 2   | 60-minute drive                                       | same; battery drain noted                                                              |        |
| 3   | 90-minute drive                                       | same; no unrecoverable loss                                                            |        |
| 4   | Wake lock supported path (iOS 16.4+)                  | "Screen: kept awake" shown; screen stays on                                            |        |
| 5   | Wake lock unsupported / released (Low Power Mode)     | Warning shown; time still recorded; route gap flagged                                  |        |
| 6   | Learner switches to another app for 2 min and returns | Visibility gap counted; lock screen restored; recording resumes                        |        |
| 7   | Phone locked (screen off) for 2 min                   | Route gap flagged "may be incomplete"; duration intact                                 |        |
| 8   | Airplane mode for 5 min mid-drive                     | "offline — recording locally"; samples upload after reconnect; no duplicates in review |        |
| 9   | Adult phone loses network for 2 min                   | Live view shows Disconnected/stale; recovers                                           |        |
| 10  | Stop at a traffic light (≤ 25 s)                      | End control stays disabled                                                             |        |
| 11  | Park ≥ 30 s                                           | End control enables on both phones; hold + confirm ends                                |        |
| 12  | End via override (GPS off)                            | Reason required; drive marked incomplete; adult sees override                          |        |
| 13  | Force-quit the PWA mid-drive and reopen               | Returns to locked screen; pending samples upload                                       |        |
| 14  | Forgotten session (leave active overnight)            | Next open shows locked screen; end via override; adult corrects duration with reason   |        |
| 15  | PDF download from Files/Share sheet                   | Opens and prints cleanly                                                               |        |

## Android (recent Chrome / installed PWA)

Repeat rows 1–15, plus:
| 16 | Revoke location permission mid-drive | "Location permission denied" shown; timer continues; manual path offered | |
| 17 | Battery saver enabled | Warnings shown; note any throttling | |
| 18 | Chrome "Add to Home screen" vs. browser tab | Both work | |

## Desktop browser

| 19 | Account, parent review, progress, PDF print | Renders cleanly at 1280 px and prints without clipping | |

## Release gate (PRD §14.3)

- [ ] At least ten real-world drives across iOS and Android with no unrecoverable record loss.
- [ ] GPS route completeness ≥ 90% of active minutes in controlled drives.
- [ ] Every row above has a recorded result and device details.
