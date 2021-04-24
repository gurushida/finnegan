import { DartPlayed } from './types.ts';

export function getDartDescription(dart: DartPlayed) {
    if (dart.multiplier === 0) {
        return '  0';
    }
    if (getDartScore(dart) === 50) {
        return ' 50';
    }
    if (dart.baseValue === 25) {
        return ' 25';
    }
    switch (dart.multiplier) {
        case 1: return `${dart.baseValue}`.padStart(3, ' ');
        case 2: return `D${dart.baseValue}`.padStart(3, ' ');
        case 3: return `T${dart.baseValue}`.padStart(3, ' ');
    }
}


export function getDartScore(dart: DartPlayed) {
    return dart.multiplier * dart.baseValue;
}


export function isIgnored(dart: DartPlayed) {
    return dart.status !== 'OK';
}




