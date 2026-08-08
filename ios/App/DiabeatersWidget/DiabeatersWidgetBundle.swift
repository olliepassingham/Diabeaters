import SwiftUI
import WidgetKit

@main
struct DiabeatersWidgetBundle: WidgetBundle {
    var body: some Widget {
        DiabeatersStatusWidget()
        if #available(iOSApplicationExtension 16.2, *) {
            ExerciseLiveActivity()
        }
    }
}
