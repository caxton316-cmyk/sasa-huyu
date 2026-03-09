import { localize } from '@deriv-com/translations';
import { TDescriptionItem } from '../../pages/bot-builder/quick-strategy/types';

export const MAKOTI_V3_RISE_FALL = (): TDescriptionItem[] => [
    {
        type: 'subtitle',
        content: [localize('MAKOTI V3 RISE FALL Strategy')],
        expanded: true,
        no_collapsible: false,
    },
    {
        type: 'text',
        content: [
            localize(
                'This is a custom Rise/Fall strategy designed for automated trading on the Deriv platform.'
            ),
        ],
    },
];
