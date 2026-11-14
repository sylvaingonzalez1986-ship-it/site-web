import type { PlacardMapBuildingId } from "./KqPlacardMap.geometry";

/** All anchors are original painting pixels (1536 × 1024), shared by art and input. */
export const MAP_CLEAN_PLATE = "/placard/map/living-v2/clean-patches-quizzshow-v1.webp";
export const MAP_CLEAN_ATLAS = { width: 802, height: 115 } as const;
export const MAP_CLEAN_REGIONS = [
  { id: "bank-sign", x: 880, y: 78, width: 90, height: 104, atlasX: 0 },
  { id: "shop-sign", x: 918, y: 695, width: 80, height: 90, atlasX: 90 },
  { id: "flag", x: 1328, y: 147, width: 100, height: 94, atlasX: 170 },
  { id: "notices", x: 679, y: 385, width: 144, height: 115, atlasX: 270 },
  { id: "hydrangea", x: 8, y: 280, width: 130, height: 85, atlasX: 414 },
  { id: "daisies", x: 534, y: 272, width: 48, height: 62, atlasX: 544 },
  { id: "library-sign", x: 193, y: 734, width: 210, height: 78, atlasX: 592 },
] as const;
export const MAP_SCENERY = [
  { id: "library-sign", building: "collection", anchor: [298, 742], amplitude: 2.2, duration: 2.65, delay: .4,
    shape: "M199 780Q200 764 220 757Q237 750 260 751L346 751Q377 749 392 765Q400 774 396 782L392 783L397 785Q400 798 383 805Q371 809 350 809L238 809Q213 808 203 796Q197 789 199 780ZM235 748Q234 740 240 738Q247 737 248 746L247 759Q249 765 242 765Q235 765 236 759ZM351 748Q350 739 357 738Q364 738 365 746L364 759Q366 766 359 766Q352 766 353 759Z",
    patch: "M198 781Q198 764 220 756L232 752L232 742Q233 735 241 735Q251 736 251 746L251 750L348 750L348 741Q350 734 358 735Q369 737 368 747L367 752Q388 757 397 771Q402 779 397 784Q403 797 384 807Q371 810 350 810L238 810Q211 810 201 798Q195 790 198 781Z" },
  { id: "hydrangea", building: "warehouse", anchor: [66, 350], amplitude: 4.5, duration: 1.95, delay: 0,
    shape: "M14 324Q16 314 27 311Q24 303 31 298Q30 292 38 291Q39 286 47 288Q52 285 58 288Q60 284 66 287Q70 292 73 299Q77 296 82 298Q85 293 91 295Q94 296 95 300Q100 298 102 306L103 313Q109 310 115 314Q122 315 124 324Q133 326 129 343Q119 348 111 343Q110 355 98 354L89 350Q79 359 67 351Q51 359 40 354Q33 358 32 346Q12 348 12 333Z",
    patch: "M14 324Q16 314 27 311Q24 303 31 298Q30 292 38 291Q39 286 47 288Q52 285 58 288Q60 284 66 287Q70 292 73 299Q77 296 82 298Q85 293 91 295Q94 296 95 300Q100 298 102 306L103 313Q109 310 115 314Q122 315 124 324Q138 326 136 345L116 360L40 363Q8 357 10 322Z" },
  { id: "daisies", building: "warehouse", anchor: [553, 325], amplitude: 5.5, duration: 2.35, delay: .7,
    shape: "M539 287Q544 282 550 285Q552 274 559 277Q567 275 568 286Q580 291 571 298Q576 302 570 306Q584 315 572 322Q572 332 559 327L544 330L535 320Q533 310 536 304L539 297Z",
    patch: "M536 285Q547 270 566 274L581 291L582 327L568 333L534 331L534 299Z" },
  { id: "bank-sign", building: "bank", anchor: [917, 80], amplitude: 5, duration: 2.3, delay: 0,
    shape: "M912 79L922 79L924 95L914 95ZM915 86C938 82 953 99 958 121C964 145 952 163 933 169C910 175 891 158 887 136C882 113 894 92 915 86Z",
    patch: "M911 81L928 81L928 85C950 86 960 99 964 124C969 152 951 174 926 176C902 177 882 155 881 130C880 108 890 92 909 85Z" },
  { id: "shop-sign", building: "shop", anchor: [963, 695], amplitude: 6, duration: 2.8, delay: .6,
    shape: "M958 694L968 694L972 720L962 720ZM924 716L974 701Q980 700 982 708L989 757Q989 763 981 766L941 779Q932 779 930 770L923 726Q922 719 924 716Z",
    patch: "M958 695L974 695Q986 696 988 710L994 759Q994 768 981 771L941 783Q927 782 926 772L919 726L920 714L959 702Z" },
  { id: "flag", building: "office", anchor: [1348, 159], amplitude: 2.8, duration: 1.7, delay: .25,
    shape: "M1348 155Q1369 158 1385 154Q1403 158 1413 156Q1420 155 1418 164L1404 226Q1403 233 1395 232Q1378 230 1360 222Q1347 218 1333 222Z",
    patch: "M1350 154Q1369 153 1385 151L1423 152L1412 235L1391 238L1355 226L1333 225Z" },
  { id: "notices", building: "missions", anchor: [749, 407], amplitude: 2.5, duration: 2, delay: .9,
    shape: "M720 397L776 393L781 470L725 474Z",
    patch: "M680 391L821 387L821 496L680 496Z" },
  { id: "note-left", building: "missions", anchor: [698, 401], amplitude: -3.5, duration: 2.5, delay: 1.2,
    shape: "M681 398L712 391L721 434L690 443Z" },
  { id: "note-low", building: "missions", anchor: [701, 450], amplitude: 3, duration: 2.1, delay: 1.4,
    shape: "M687 445L716 443L718 492L687 494Z" },
  { id: "note-right", building: "missions", anchor: [802, 399], amplitude: -4, duration: 2.4, delay: 1.6,
    shape: "M784 388L820 394L814 438L778 431Z" },
  { id: "note-corner", building: "missions", anchor: [801, 446], amplitude: 3.5, duration: 2.2, delay: 1.8,
    shape: "M791 437L821 445L809 484L779 475Z" },
] as const;

export const MAP_ENTRANCES: Record<PlacardMapBuildingId, readonly [number, number]> = {
  warehouse: [365, 326], bank: [799, 278], office: [1178, 375],
  market: [264, 604], shop: [714, 871], arena: [1244, 696],
  missions: [752, 515], collection: [429, 892],
};

