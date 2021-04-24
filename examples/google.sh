#!/bin/bash
echo "Say 'search <foo>' to google for <foo>"
echo

while read line
do
  echo "Input from speech recognition: $line"
  if [[ "$line" =~ ^'search ' ]]; then
    QUERY=`echo "$line" | cut -c 8-`
    echo GOOGLE "$QUERY"
    open "https://google.com/search?q=$QUERY"
  fi

done

