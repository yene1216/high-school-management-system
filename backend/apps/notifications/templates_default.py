"""Built-in message templates, English and Amharic. Schools can override any of them with NotificationTemplate rows.

Variables use string.Template syntax ($name). Have a native Amharic speaker review the wording before launch.
"""

DEFAULT_TEMPLATES = {
    "attendance.absent": {
        "en": ("Absence notice: $student_name", "$student_name was marked absent on $date. If this is unexpected, please contact the school."),
        "am": ("የመቅረት ማሳወቂያ", "$student_name በ$date ትምህርት ቤት አልተገኙም። ያልተጠበቀ ከሆነ እባክዎ ትምህርት ቤቱን ያነጋግሩ።"),
    },
    "attendance.late": {
        "en": ("Late arrival: $student_name", "$student_name arrived late on $date."),
        "am": ("የመዘግየት ማሳወቂያ", "$student_name በ$date ዘግይተው ደርሰዋል።"),
    },
    "attendance.repeated_absence": {
        "en": ("Repeated absences: $student_name", "$student_name has been absent $count times in the last 30 days."),
        "am": ("ተደጋጋሚ መቅረት", "$student_name በ30 ቀናት ውስጥ $count ጊዜ ቀርተዋል።"),
    },
    "grades.published": {
        "en": ("New result: $subject", "$student_name's result for $assessment ($subject) is now available."),
        "am": ("አዲስ ውጤት", "የ$student_name የ$subject ($assessment) ውጤት ታትሟል።"),
    },
    "billing.invoice_issued": {
        "en": ("New invoice $invoice_number", "An invoice of $amount $currency for $student_name is due on $due_date."),
        "am": ("አዲስ ደረሰኝ $invoice_number", "ለ$student_name የ$amount $currency ደረሰኝ ተዘጋጅቷል። የመክፈያ ቀን፦ $due_date።"),
    },
    "billing.due_reminder": {
        "en": ("Payment reminder: $invoice_number", "Invoice $invoice_number for $student_name is due on $due_date. Balance: $balance $currency."),
        "am": ("የክፍያ ማስታወሻ", "የ$student_name ደረሰኝ $invoice_number በ$due_date ይከፈላል። ቀሪ ሂሳብ፦ $balance $currency።"),
    },
    "billing.overdue": {
        "en": ("Overdue invoice: $invoice_number", "Invoice $invoice_number for $student_name was due on $due_date. Balance: $balance $currency."),
        "am": ("ጊዜው ያለፈበት ደረሰኝ", "የ$student_name ደረሰኝ $invoice_number የመክፈያ ቀኑ $due_date ነበር። ቀሪ ሂሳብ፦ $balance $currency።"),
    },
    "payment.received": {
        "en": ("Payment received", "We received $amount $currency for invoice $invoice_number. Receipt: $receipt_number."),
        "am": ("ክፍያ ተቀብለናል", "ለደረሰኝ $invoice_number የ$amount $currency ክፍያ ተቀብለናል። ደረሰኝ ቁጥር፦ $receipt_number።"),
    },
}
