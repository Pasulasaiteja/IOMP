package com.zenscreen.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * BootReceiver
 * Receives BOOT_COMPLETED broadcast so ZenScreen can restart
 * background tracking after the device reboots.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            // Start the foreground tracking service after boot
            Intent serviceIntent = new Intent(context, TrackingService.class);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        }
    }
}
