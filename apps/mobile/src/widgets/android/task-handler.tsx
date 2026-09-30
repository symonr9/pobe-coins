import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { loadSnapshot } from '../snapshot';
import { PurseWidget } from './PurseWidget';

/** Runs headless when Android asks the widget to render. Uses the last saved snapshot. */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(<PurseWidget snapshot={await loadSnapshot()} />);
      break;
    default:
      break;
  }
}
