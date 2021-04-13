#!/bin/bash

# This example script uses a empty fart configuration file
# that does not define any command. As a consequence, all the
# text identified by the speech recognition engine will be
# printed with a "???:" prefix.
#
# The google.sh script will look for lines starting with "???:search "
# and google whatever is after this prefix.
#
# So, if you say "search chess", the speech recognition should
# print "???:search chess" which in turn should be picked by
# the google.sh script to google "chess" for you.
#
# Happy hacking !

python3 -u fart.py no_commands_en.json 2> /dev/null | ./google.sh


