/**
 * @OnlyCurrentDoc
 *
 * The above comment directs Apps Script to limit the scope of file
 * access for this add-on. It specifies that this add-on will only
 * attempt to read or modify the files in which the add-on is used,
 * and not all of the user's files. The authorization request message
 * presented to users will reflect this limited scope.
 */

/**
 * Creates a menu entry in the Google Docs UI when the document is opened.
 * This method is only used by the regular add-on, and is never called by
 * the mobile add-on version.
 *
 * @param {object} e The event parameter for a simple onOpen trigger. To
 *     determine which authorization mode (ScriptApp.AuthMode) the trigger is
 *     running in, inspect e.authMode.
 */
function onOpen(e) {
  DocumentApp.getUi().createAddonMenu()
      .addItem('Start', 'showSidebar')
      .addToUi();
}

/**
 * Runs when the add-on is installed.
 * This method is only used by the regular add-on, and is never called by
 * the mobile add-on version.
 *
 * @param {object} e The event parameter for a simple onInstall trigger. To
 *     determine which authorization mode (ScriptApp.AuthMode) the trigger is
 *     running in, inspect e.authMode. (In practice, onInstall triggers always
 *     run in AuthMode.FULL, but onOpen triggers may be AuthMode.LIMITED or
 *     AuthMode.NONE.)
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * Opens a sidebar in the document containing the add-on's user interface.
 * This method is only used by the regular add-on, and is never called by
 * the mobile add-on version.
 */
function showSidebar() {
  const ui = HtmlService.createHtmlOutputFromFile('sidebar')
      .setTitle('Rubric Evaluator');
  DocumentApp.getUi().showSidebar(ui);
}
function getSavedRubrics() {
  var userProps = PropertiesService.getUserProperties();
  var savedRubricsStr = userProps.getProperty("savedRubrics");
  var savedRubrics = savedRubricsStr ? JSON.parse(savedRubricsStr) : {};
  var options = [];
  
  // Iterate through saved rubrics and create an <option> for each name.
  for (var rubricName in savedRubrics) {
    options.push('<option value="' + rubricName + '">' + rubricName + '</option>');
  }
  
  if (options.length === 0) {
    return '<option disabled selected>No saved rubrics</option>';
  }
  
  return options.join('');
}
function getRubric(rubric_name) {
  var userProps = PropertiesService.getUserProperties();
  var savedRubricsStr = userProps.getProperty("savedRubrics");
  var savedRubrics = savedRubricsStr ? JSON.parse(savedRubricsStr) : {};
  return savedRubrics[rubric_name] || "";
}
/**
 * Saves the provided rubric somewhere
 */
function saveRubric(rubric_name, rubric) {
  if (!rubric_name || !rubric) {
    throw new Error("Both rubric name and rubric text must be provided.");
  }
  
  var userProps = PropertiesService.getUserProperties();
  var savedRubricsStr = userProps.getProperty("savedRubrics");
  var savedRubrics = savedRubricsStr ? JSON.parse(savedRubricsStr) : {};
  
  // Save the rubric content under its name
  savedRubrics[rubric_name] = rubric;
  
  userProps.setProperty("savedRubrics", JSON.stringify(savedRubrics));
  Logger.log("Saved rubrics: " + JSON.stringify(savedRubrics));
  
  return "Rubric '" + rubric_name + "' saved successfully!";
}

/**
 * Should read in entire document and evaluate it using the selected rubric
 */
function evaluateDocument(rubric) {
  var selectedText;
  try {
    // Retrieve the selected text from the document
    selectedText = getSelectedText();
  } catch(e) {
    return "<p style='color:red;'>Error: " + e.message + "</p>";
  }
  
  // Combine the rubric and the selected text.
  var evaluationInput = "Rubric:\n" + rubric + "\n\nDocument Text:\n" + selectedText.join("\n");
  
  // Log for debugging (view via Apps Script Logger)
  Logger.log("Evaluation Input:\n" + evaluationInput);
  
  // Simulate an evaluation result.  
  // Replace this with your actual API call later.
  var evaluationResult = "Simulated Evaluation: Based on the rubric, the selected document text meets the criteria fairly well. " +
                         "For instance, the tone is appropriate and the clarity is sufficient, but adding more examples could further improve the evaluation.";
                         
  // Return the evaluation result as HTML.
  return "<p>" + evaluationResult + "</p>";
}

/**
 * takes the provided feedback and appends it to the end of the doc?
 */
function importFeedbackToDoc() {
  //TODO
}

/**
 * Gets the text the user has selected. If there is no selection,
 * this function displays an error message.
 *
 * @return {Array.<string>} The selected text.
 */
function getSelectedText() {
  const selection = DocumentApp.getActiveDocument().getSelection();
  const text = [];
  if (selection) {
    const elements = selection.getSelectedElements();
    for (let i = 0; i < elements.length; ++i) {
      if (elements[i].isPartial()) {
        const element = elements[i].getElement().asText();
        const startIndex = elements[i].getStartOffset();
        const endIndex = elements[i].getEndOffsetInclusive();

        text.push(element.getText().substring(startIndex, endIndex + 1));
      } else {
        const element = elements[i].getElement();
        // Only translate elements that can be edited as text; skip images and
        // other non-text elements.
        if (element.editAsText) {
          const elementText = element.asText().getText();
          // This check is necessary to exclude images, which return a blank
          // text element.
          if (elementText) {
            text.push(elementText);
          }
        }
      }
    }
  }
  if (!text.length) throw new Error('Please select some text.');
  return text;
}

/**
 * Replaces the text of the current selection with the provided text, or
 * inserts text at the current cursor location. (There will always be either
 * a selection or a cursor.) If multiple elements are selected, only inserts the
 * translated text in the first element that can contain text and removes the
 * other elements.
 *
 * @param {string} newText The text with which to replace the current selection.
 */
function insertText(newText) {
  const selection = DocumentApp.getActiveDocument().getSelection();
  if (selection) {
    let replaced = false;
    const elements = selection.getSelectedElements();
    if (elements.length === 1 && elements[0].getElement().getType() ===
      DocumentApp.ElementType.INLINE_IMAGE) {
      throw new Error('Can\'t insert text into an image.');
    }
    for (let i = 0; i < elements.length; ++i) {
      if (elements[i].isPartial()) {
        const element = elements[i].getElement().asText();
        const startIndex = elements[i].getStartOffset();
        const endIndex = elements[i].getEndOffsetInclusive();
        element.deleteText(startIndex, endIndex);
        if (!replaced) {
          element.insertText(startIndex, newText);
          replaced = true;
        } else {
          // This block handles a selection that ends with a partial element. We
          // want to copy this partial text to the previous element so we don't
          // have a line-break before the last partial.
          const parent = element.getParent();
          const remainingText = element.getText().substring(endIndex + 1);
          parent.getPreviousSibling().asText().appendText(remainingText);
          // We cannot remove the last paragraph of a doc. If this is the case,
          // just remove the text within the last paragraph instead.
          if (parent.getNextSibling()) {
            parent.removeFromParent();
          } else {
            element.removeFromParent();
          }
        }
      } else {
        const element = elements[i].getElement();
        if (!replaced && element.editAsText) {
          // Only translate elements that can be edited as text, removing other
          // elements.
          element.clear();
          element.asText().setText(newText);
          replaced = true;
        } else {
          // We cannot remove the last paragraph of a doc. If this is the case,
          // just clear the element.
          if (element.getNextSibling()) {
            element.removeFromParent();
          } else {
            element.clear();
          }
        }
      }
    }
  } else {
    const cursor = DocumentApp.getActiveDocument().getCursor();
    const surroundingText = cursor.getSurroundingText().getText();
    const surroundingTextOffset = cursor.getSurroundingTextOffset();

    // If the cursor follows or preceds a non-space character, insert a space
    // between the character and the translation. Otherwise, just insert the
    // translation.
    if (surroundingTextOffset > 0) {
      if (surroundingText.charAt(surroundingTextOffset - 1) !== ' ') {
        newText = ' ' + newText;
      }
    }
    if (surroundingTextOffset < surroundingText.length) {
      if (surroundingText.charAt(surroundingTextOffset) !== ' ') {
        newText += ' ';
      }
    }
    cursor.insertText(newText);
  }
}